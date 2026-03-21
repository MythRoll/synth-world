import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits, assertOwnership } from './creditService.js';

// ─── Symbols & pay tables ────────────────────────────────────────────────────

const SYMBOLS   = ['🔥', '⚡', '💎', '👑', '🌟', '🃏', '💀', '🎰'];
const SYM_WEIGHT = [15, 14, 6, 8, 12, 18, 20, 2]; // lower weight = rarer
const SYM_VALUE  = { '🎰': 50, '💎': 25, '👑': 20, '🔥': 15, '⚡': 12, '🌟': 10, '🃏': 5, '💀': 0 };

function weightedRandom() {
  const total = SYM_WEIGHT.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYM_WEIGHT[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 2];
}

function spinReels() {
  return [[weightedRandom(), weightedRandom(), weightedRandom()],
          [weightedRandom(), weightedRandom(), weightedRandom()],
          [weightedRandom(), weightedRandom(), weightedRandom()]];
}

function evalSlots(reels, bet) {
  // Middle row wins
  const mid = [reels[0][1], reels[1][1], reels[2][1]];
  if (mid[0] === mid[1] && mid[1] === mid[2]) {
    const mult = SYM_VALUE[mid[0]];
    const isBonus = mid[0] === '🎰';
    return { win: mult > 0, payout: bet * mult, bonus: isBonus ? 'JACKPOT!' : null };
  }
  // Two of a kind on middle row: small payout
  if (mid[0] === mid[1] || mid[1] === mid[2]) {
    const sym = mid[0] === mid[1] ? mid[0] : mid[2];
    if (SYM_VALUE[sym] > 0) return { win: true, payout: Math.floor(bet * 0.5), bonus: null };
  }
  // Top and bottom diagonal wins
  const diag1 = [reels[0][0], reels[1][1], reels[2][2]];
  const diag2 = [reels[0][2], reels[1][1], reels[2][0]];
  for (const d of [diag1, diag2]) {
    if (d[0] === d[1] && d[1] === d[2] && SYM_VALUE[d[0]] > 0) {
      return { win: true, payout: Math.floor(bet * (SYM_VALUE[d[0]] * 0.6)), bonus: 'Diagonal!' };
    }
  }
  return { win: false, payout: 0, bonus: null };
}

// ─── Card helpers ────────────────────────────────────────────────────────────

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const CARD_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':10,'Q':10,'K':10,'A':11 };

function freshDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(`${r}${s}`);
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(cards) {
  let total = 0; let aces = 0;
  for (const c of cards) {
    const rank = c.replace(/[♠♥♦♣]/, '');
    total += CARD_VAL[rank] || 0;
    if (rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function dealCard(deck) { return deck.pop(); }

// ─── Trivia question bank ─────────────────────────────────────────────────────

const QUESTIONS = [
  { q: 'What does AI stand for?', options: ['Automated Input','Artificial Intelligence','Advanced Interface','Autonomous Integration'], correct: 'Artificial Intelligence' },
  { q: 'Which company created GPT-4?', options: ['Google','Meta','OpenAI','Anthropic'], correct: 'OpenAI' },
  { q: 'What is the smallest unit of data in computing?', options: ['Byte','Nibble','Bit','Kilobyte'], correct: 'Bit' },
  { q: 'What does HTTP stand for?', options: ['HyperText Transfer Protocol','High Transfer Text Process','Hyper Terminal Transfer Program','Home Text Transfer Protocol'], correct: 'HyperText Transfer Protocol' },
  { q: 'Which language is primarily used for web styling?', options: ['HTML','CSS','JavaScript','Python'], correct: 'CSS' },
  { q: 'What is a neural network modeled after?', options: ['Computer circuits','The human brain','DNA','The internet'], correct: 'The human brain' },
  { q: 'What does GPU stand for?', options: ['General Processing Unit','Graphics Processing Unit','Global Program Utility','Grid Processing Unit'], correct: 'Graphics Processing Unit' },
  { q: 'What is the binary representation of the decimal 10?', options: ['1010','1100','0110','1001'], correct: '1010' },
  { q: 'Who invented the World Wide Web?', options: ['Bill Gates','Linus Torvalds','Tim Berners-Lee','Steve Jobs'], correct: 'Tim Berners-Lee' },
  { q: 'What does SQL stand for?', options: ['Structured Query Language','Simple Queue Language','Standard Query Logic','Sequential Query List'], correct: 'Structured Query Language' },
  { q: 'What is the time complexity of binary search?', options: ['O(n)','O(n²)','O(log n)','O(1)'], correct: 'O(log n)' },
  { q: 'Which protocol is used to send email?', options: ['FTP','SMTP','HTTP','SSH'], correct: 'SMTP' },
  { q: 'What is the output of 2 XOR 3 in binary?', options: ['1','5','7','0'], correct: '1' },
  { q: 'Which data structure uses FIFO ordering?', options: ['Stack','Queue','Tree','Heap'], correct: 'Queue' },
  { q: 'What does RAM stand for?', options: ['Random Access Memory','Read And Modify','Rapid Access Module','Remote Access Management'], correct: 'Random Access Memory' },
];

function pickQuestion() {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

// ─── Roulette helpers ─────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function evalRoulette(number, betType, betValue, bet) {
  const isRed = RED_NUMBERS.has(number);
  let won = false; let mult = 0;
  if (betType === 'number' && betValue === String(number)) { won = true; mult = 36; }
  else if (betType === 'color' && betValue === 'red' && isRed) { won = true; mult = 2; }
  else if (betType === 'color' && betValue === 'black' && !isRed && number !== 0) { won = true; mult = 2; }
  else if (betType === 'range' && betValue === '1-18' && number >= 1 && number <= 18) { won = true; mult = 2; }
  else if (betType === 'range' && betValue === '19-36' && number >= 19 && number <= 36) { won = true; mult = 2; }
  else if (betType === 'parity' && betValue === 'odd' && number % 2 === 1) { won = true; mult = 2; }
  else if (betType === 'parity' && betValue === 'even' && number % 2 === 0 && number !== 0) { won = true; mult = 2; }
  return { won, payout: won ? bet * mult : 0 };
}

// ─── Crash helpers ────────────────────────────────────────────────────────────

function generateCrashPoint() {
  const r = Math.random();
  return Math.max(1.01, parseFloat((1 / (1 - r) * 0.97).toFixed(2)));
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function handleGameAction(params, userId) {
  const { action } = params;
  switch (action) {
    case 'create_table':  return createTable(params, userId);
    case 'join_table':    return joinTable(params, userId);
    case 'leave_table':   return leaveTable(params, userId);
    case 'start_game':    return startGame(params, userId);
    case 'play_round':    return playRound(params, userId);
    default:
      throw Object.assign(new Error(`Unknown game action: ${action}`), { status: 400 });
  }
}

/** Slots-spin — standalone function endpoint */
export async function handleSlotsSpin({ agent_id, bet, machine_id }, userId) {
  if (!agent_id || !bet) throw Object.assign(new Error('agent_id and bet required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const betAmt = Number(bet);
  if (betAmt < 1) throw Object.assign(new Error('Minimum bet is 1 credit.'), { status: 400 });

  // Deduct bet
  await transferCredits(agent_id, null, betAmt, 'slots_bet', `Slots bet (machine ${machine_id || '?'})`);

  const reels = spinReels();
  const { win, payout, bonus } = evalSlots(reels, betAmt);

  if (win && payout > 0) {
    await transferCredits(null, agent_id, payout, 'slots_win', `Slots win (machine ${machine_id || '?'})`);
  }

  const [[{ credits }]] = await pool.query('SELECT credits FROM agents WHERE id = ?', [agent_id]);
  return { reels, win, payout, bonus, new_balance: Number(credits) };
}

// ─── create_table ─────────────────────────────────────────────────────────────

async function createTable({ agent_id, game_type, name, min_stake, max_players }, userId) {
  if (!agent_id || !game_type) throw Object.assign(new Error('agent_id and game_type required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const validTypes = ['blackjack', 'poker', 'roulette', 'trivia', 'crash'];
  if (!validTypes.includes(game_type)) {
    throw Object.assign(new Error(`Invalid game_type. Must be one of: ${validTypes.join(', ')}`), { status: 400 });
  }

  const id = uuidv4();
  const state = { name: name || `${game_type} table`, created_by: agent_id };
  await pool.query(
    `INSERT INTO game_tables (id, game_type, status, min_bet, max_players, state)
     VALUES (?, ?, 'waiting', ?, ?, ?)`,
    [id, game_type, Number(min_stake || 5), Number(max_players || 6), JSON.stringify(state)]
  );

  // Auto-join creator
  await _joinTable(id, agent_id, Number(min_stake || 5));

  const [[table]] = await pool.query('SELECT * FROM game_tables WHERE id = ?', [id]);
  return { data: table };
}

async function _joinTable(tableId, agentId, stake) {
  // Count existing seats
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM game_players WHERE table_id = ?', [tableId]
  );
  await pool.query(
    `INSERT INTO game_players (id, table_id, agent_id, seat_number, chips, status)
     VALUES (?, ?, ?, ?, ?, 'waiting')`,
    [uuidv4(), tableId, agentId, Number(count) + 1, stake]
  );
}

// ─── join_table ───────────────────────────────────────────────────────────────

async function joinTable({ agent_id, table_id }, userId) {
  if (!agent_id || !table_id) throw Object.assign(new Error('agent_id and table_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[table]] = await pool.query('SELECT * FROM game_tables WHERE id = ?', [table_id]);
  if (!table) throw Object.assign(new Error('Table not found.'), { status: 404 });
  if (table.status !== 'waiting') throw Object.assign(new Error('Table is not accepting players.'), { status: 409 });

  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM game_players WHERE table_id = ?', [table_id]
  );
  if (Number(count) >= table.max_players) throw Object.assign(new Error('Table is full.'), { status: 409 });

  // Check already seated
  const [[existing]] = await pool.query(
    'SELECT id FROM game_players WHERE table_id = ? AND agent_id = ?', [table_id, agent_id]
  );
  if (existing) throw Object.assign(new Error('Agent already at this table.'), { status: 409 });

  const stake = Number(table.min_bet);
  await transferCredits(agent_id, null, stake, 'game_stake', `Buy-in for ${table.game_type} table`);
  await _joinTable(table_id, agent_id, stake);

  return { data: { table_id, agent_id, chips: stake } };
}

// ─── leave_table ──────────────────────────────────────────────────────────────

async function leaveTable({ agent_id, table_id }, userId) {
  if (!agent_id || !table_id) throw Object.assign(new Error('agent_id and table_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[player]] = await pool.query(
    'SELECT * FROM game_players WHERE table_id = ? AND agent_id = ?', [table_id, agent_id]
  );
  if (!player) throw Object.assign(new Error('Player not at this table.'), { status: 404 });

  const [[table]] = await pool.query('SELECT * FROM game_tables WHERE id = ?', [table_id]);

  // Refund remaining chips if game not active
  if (table.status !== 'active' && Number(player.chips) > 0) {
    await transferCredits(null, agent_id, Number(player.chips), 'game_cashout',
      `Cashout from ${table.game_type} table`);
  }

  await pool.query('DELETE FROM game_players WHERE table_id = ? AND agent_id = ?', [table_id, agent_id]);
  return { data: { table_id, agent_id, returned: player.chips } };
}

// ─── start_game ───────────────────────────────────────────────────────────────

async function startGame({ table_id }, userId) {
  if (!table_id) throw Object.assign(new Error('table_id required.'), { status: 400 });

  const [[table]] = await pool.query('SELECT * FROM game_tables WHERE id = ?', [table_id]);
  if (!table) throw Object.assign(new Error('Table not found.'), { status: 404 });
  if (table.status !== 'waiting') throw Object.assign(new Error('Game already started.'), { status: 409 });

  const [players] = await pool.query('SELECT * FROM game_players WHERE table_id = ?', [table_id]);
  if (players.length < 1) throw Object.assign(new Error('Need at least 1 player to start.'), { status: 400 });

  let roundData = {};

  if (table.game_type === 'blackjack') {
    const deck = freshDeck();
    const hands = {};
    for (const p of players) {
      hands[p.agent_id] = [dealCard(deck), dealCard(deck)];
    }
    const dealer = [dealCard(deck), dealCard(deck)];
    roundData = { status: 'playing', deck, hands, dealer_hand: dealer, actions: {} };
  }

  else if (table.game_type === 'poker') {
    const deck = freshDeck();
    const hands = {};
    for (const p of players) {
      hands[p.agent_id] = [dealCard(deck), dealCard(deck)];
    }
    const community = [];
    const bets = {}; const folded = [];
    for (const p of players) bets[p.agent_id] = 0;
    roundData = { status: 'betting', deck, hands, community, bets, folded, pot: 0, current_bet: 0 };
  }

  else if (table.game_type === 'roulette') {
    roundData = { status: 'betting', bets: {} };
  }

  else if (table.game_type === 'crash') {
    const crashPoint = generateCrashPoint();
    roundData = { status: 'running', crash_point: crashPoint, cashed_out: {} };
  }

  else if (table.game_type === 'trivia') {
    const question = pickQuestion();
    roundData = { status: 'answering', question, answers: {}, winners: [] };
  }

  // Create the round record
  const [[{ maxRound }]] = await pool.query(
    'SELECT COALESCE(MAX(round_number), 0) AS maxRound FROM game_rounds WHERE table_id = ?', [table_id]
  );
  const roundId = uuidv4();
  await pool.query(
    'INSERT INTO game_rounds (id, table_id, round_number, outcome) VALUES (?, ?, ?, ?)',
    [roundId, table_id, Number(maxRound) + 1, JSON.stringify(roundData)]
  );

  await pool.query(
    `UPDATE game_tables SET status = 'active' WHERE id = ?`, [table_id]
  );
  await pool.query(
    `UPDATE game_players SET status = 'active' WHERE table_id = ?`, [table_id]
  );

  const [[round]] = await pool.query('SELECT * FROM game_rounds WHERE id = ?', [roundId]);
  return { data: round };
}

// ─── play_round ───────────────────────────────────────────────────────────────

async function playRound({ table_id, agent_id, move }, userId) {
  if (!table_id || !agent_id || !move) {
    throw Object.assign(new Error('table_id, agent_id and move required.'), { status: 400 });
  }
  await assertOwnership(agent_id, userId);

  const [[table]] = await pool.query('SELECT * FROM game_tables WHERE id = ?', [table_id]);
  if (!table) throw Object.assign(new Error('Table not found.'), { status: 404 });
  if (table.status !== 'active') throw Object.assign(new Error('No active game at this table.'), { status: 409 });

  const [[player]] = await pool.query(
    'SELECT * FROM game_players WHERE table_id = ? AND agent_id = ?', [table_id, agent_id]
  );
  if (!player) throw Object.assign(new Error('Agent not at this table.'), { status: 404 });

  const [[latestRound]] = await pool.query(
    'SELECT * FROM game_rounds WHERE table_id = ? ORDER BY round_number DESC LIMIT 1', [table_id]
  );
  if (!latestRound) throw Object.assign(new Error('No round found.'), { status: 404 });

  const roundData = JSON.parse(latestRound.outcome || '{}');
  let result;

  switch (table.game_type) {
    case 'blackjack': result = await playBlackjack(table_id, agent_id, move, roundData, latestRound.id, player); break;
    case 'poker':     result = await playPoker(table_id, agent_id, move, roundData, latestRound.id, player); break;
    case 'roulette':  result = await playRoulette(table_id, agent_id, move, roundData, latestRound.id, player); break;
    case 'crash':     result = await playCrash(table_id, agent_id, move, roundData, latestRound.id, player); break;
    case 'trivia':    result = await playTrivia(table_id, agent_id, move, roundData, latestRound.id, player); break;
    default:
      throw Object.assign(new Error(`Game type ${table.game_type} not supported.`), { status: 400 });
  }

  return result;
}

// ─── Blackjack round logic ───────────────────────────────────────────────────

async function playBlackjack(tableId, agentId, move, rd, roundId, player) {
  const { action } = move;
  const deck = rd.deck;
  const hand = rd.hands[agentId];
  if (!hand) throw Object.assign(new Error('No hand for this agent.'), { status: 400 });

  if (action === 'hit') {
    hand.push(dealCard(deck));
    const val = handValue(hand);
    if (val > 21) {
      rd.actions[agentId] = 'bust';
      await pool.query('UPDATE game_players SET status = \'bust\' WHERE table_id = ? AND agent_id = ?', [tableId, agentId]);
    }
  } else if (action === 'stand') {
    rd.actions[agentId] = 'stand';
  } else if (action === 'double') {
    // Double down: one more card, forced stand, double bet
    hand.push(dealCard(deck));
    rd.actions[agentId] = 'doubled';
    await transferCredits(agentId, null, Number(player.chips), 'blackjack_double',
      'Blackjack double down');
    await pool.query('UPDATE game_players SET chips = chips * 2 WHERE table_id = ? AND agent_id = ?', [tableId, agentId]);
  }

  // Check if all players are done
  const [allPlayers] = await pool.query('SELECT * FROM game_players WHERE table_id = ?', [tableId]);
  const allDone = allPlayers.every(p =>
    rd.actions[p.agent_id] === 'stand' ||
    rd.actions[p.agent_id] === 'bust'  ||
    rd.actions[p.agent_id] === 'doubled'
  );

  if (allDone) {
    // Dealer plays
    while (handValue(rd.dealer_hand) < 17) rd.dealer_hand.push(dealCard(deck));
    const dealerVal = handValue(rd.dealer_hand);

    // Settle
    for (const p of allPlayers) {
      const pHand = rd.hands[p.agent_id];
      const pVal  = handValue(pHand);
      const chips = Number(p.chips);
      let payout = 0;

      if (rd.actions[p.agent_id] === 'bust') {
        payout = 0; // already lost
      } else if (pVal === 21 && pHand.length === 2) {
        payout = Math.floor(chips * 2.5); // blackjack
      } else if (dealerVal > 21 || pVal > dealerVal) {
        payout = chips * 2;
      } else if (pVal === dealerVal) {
        payout = chips; // push
      }

      if (payout > 0) {
        await transferCredits(null, p.agent_id, payout, 'blackjack_win', 'Blackjack payout');
        await pool.query('UPDATE game_players SET chips = ? WHERE id = ?', [payout, p.id]);
      }
    }
    rd.status = 'finished';
    rd.dealer_value = dealerVal;
    await _endRound(tableId, roundId, rd);
  } else {
    await pool.query('UPDATE game_rounds SET outcome = ? WHERE id = ?', [JSON.stringify(rd), roundId]);
  }

  return { data: rd };
}

// ─── Poker round logic ────────────────────────────────────────────────────────

async function playPoker(tableId, agentId, move, rd, roundId, player) {
  const { action, amount } = move;
  const [allPlayers] = await pool.query('SELECT * FROM game_players WHERE table_id = ?', [tableId]);

  if (action === 'fold') {
    if (!rd.folded.includes(agentId)) rd.folded.push(agentId);
    await pool.query('UPDATE game_players SET status = \'folded\' WHERE table_id = ? AND agent_id = ?', [tableId, agentId]);
  } else if (action === 'call') {
    const toCall = rd.current_bet - (rd.bets[agentId] || 0);
    if (toCall > 0) {
      const callAmt = Math.min(toCall, Number(player.chips));
      await transferCredits(agentId, null, callAmt, 'poker_call', 'Poker call');
      rd.bets[agentId] = (rd.bets[agentId] || 0) + callAmt;
      rd.pot += callAmt;
    }
  } else if (action === 'raise') {
    const raiseAmt = Math.min(Number(amount || rd.current_bet * 2), Number(player.chips));
    await transferCredits(agentId, null, raiseAmt, 'poker_raise', 'Poker raise');
    rd.bets[agentId] = (rd.bets[agentId] || 0) + raiseAmt;
    rd.pot += raiseAmt;
    rd.current_bet = rd.bets[agentId];
  } else if (action === 'check') {
    // Only valid if no bet to call
  }

  // Advance community cards
  const activePlayers = allPlayers.filter(p => !rd.folded.includes(p.agent_id));
  const community = rd.community;

  if (community.length === 0 && activePlayers.length > 1 &&
      activePlayers.every(p => rd.bets[p.agent_id] >= rd.current_bet)) {
    // Flop
    rd.community = [dealCard(rd.deck), dealCard(rd.deck), dealCard(rd.deck)];
  } else if (community.length === 3 &&
      activePlayers.every(p => rd.bets[p.agent_id] >= rd.current_bet)) {
    // Turn
    rd.community.push(dealCard(rd.deck));
  } else if (community.length === 4 &&
      activePlayers.every(p => rd.bets[p.agent_id] >= rd.current_bet)) {
    // River
    rd.community.push(dealCard(rd.deck));
  }

  // Showdown: one active player or river bets settled
  const shouldShowdown =
    activePlayers.length === 1 ||
    (rd.community.length === 5 && activePlayers.every(p => rd.bets[p.agent_id] >= rd.current_bet));

  if (shouldShowdown) {
    // Simple hand strength: count matching ranks
    const handStrength = (agId) => {
      const combined = [...rd.hands[agId], ...rd.community];
      const ranks = combined.map(c => c.replace(/[♠♥♦♣]/, ''));
      const counts = {};
      for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
      return Math.max(...Object.values(counts));
    };

    let bestScore = -1; let winners = [];
    for (const p of activePlayers) {
      const score = handStrength(p.agent_id);
      if (score > bestScore) { bestScore = score; winners = [p.agent_id]; }
      else if (score === bestScore) winners.push(p.agent_id);
    }

    const split = Math.floor(rd.pot / winners.length);
    for (const wId of winners) {
      await transferCredits(null, wId, split, 'poker_win', 'Poker winnings');
    }
    rd.status = 'finished'; rd.winners = winners; rd.pot_paid = rd.pot;
    await _endRound(tableId, roundId, rd);
  } else {
    await pool.query('UPDATE game_rounds SET outcome = ? WHERE id = ?', [JSON.stringify(rd), roundId]);
  }

  return { data: rd };
}

// ─── Roulette round logic ─────────────────────────────────────────────────────

async function playRoulette(tableId, agentId, move, rd, roundId, player) {
  const { bet_type, bet_value, amount } = move;

  if (!bet_type || !bet_value || !amount) {
    throw Object.assign(new Error('bet_type, bet_value and amount required.'), { status: 400 });
  }
  const betAmt = Number(amount);
  await transferCredits(agentId, null, betAmt, 'roulette_bet', 'Roulette bet');

  rd.bets[agentId] = { bet_type, bet_value, amount: betAmt };

  // Spin
  const number = Math.floor(Math.random() * 37); // 0–36
  const { won, payout } = evalRoulette(number, bet_type, bet_value, betAmt);

  if (won && payout > 0) {
    await transferCredits(null, agentId, payout, 'roulette_win', `Roulette win on ${number}`);
  }

  rd.status = 'finished'; rd.result = number; rd[agentId] = { won, payout };
  await _endRound(tableId, roundId, rd);
  return { data: { number, won, payout } };
}

// ─── Crash round logic ────────────────────────────────────────────────────────

async function playCrash(tableId, agentId, move, rd, roundId, player) {
  const { action, multiplier, bet } = move;

  if (action === 'bet') {
    const betAmt = Number(bet || player.chips);
    await transferCredits(agentId, null, betAmt, 'crash_bet', 'Crash bet');
    rd.bets = rd.bets || {};
    rd.bets[agentId] = betAmt;
    await pool.query('UPDATE game_rounds SET outcome = ? WHERE id = ?', [JSON.stringify(rd), roundId]);
    return { data: { status: 'bet_placed', bet: betAmt, crash_point_hidden: true } };
  }

  if (action === 'cashout') {
    const cashMult = Number(multiplier || 1);
    if (cashMult >= rd.crash_point) {
      throw Object.assign(new Error(`Already crashed at ${rd.crash_point}x!`), { status: 409 });
    }
    if (rd.cashed_out[agentId]) {
      throw Object.assign(new Error('Already cashed out.'), { status: 409 });
    }
    const betAmt = Number((rd.bets || {})[agentId] || player.chips);
    const payout = Math.floor(betAmt * cashMult);
    await transferCredits(null, agentId, payout, 'crash_win',
      `Crash cashout at ${cashMult}x`);
    rd.cashed_out[agentId] = { multiplier: cashMult, payout };
    await pool.query('UPDATE game_rounds SET outcome = ? WHERE id = ?', [JSON.stringify(rd), roundId]);
    return { data: { cashed_out: true, multiplier: cashMult, payout, crash_point: rd.crash_point } };
  }

  throw Object.assign(new Error('action must be "bet" or "cashout"'), { status: 400 });
}

// ─── Trivia round logic ───────────────────────────────────────────────────────

async function playTrivia(tableId, agentId, move, rd, roundId, player) {
  const { answer } = move;
  if (!answer) throw Object.assign(new Error('answer required.'), { status: 400 });

  rd.answers[agentId] = answer;
  const [allPlayers] = await pool.query(
    'SELECT * FROM game_players WHERE table_id = ? AND status = \'active\'', [tableId]
  );
  const allAnswered = allPlayers.every(p => rd.answers[p.agent_id]);

  if (allAnswered) {
    const correct = rd.question.correct;
    const winners = allPlayers
      .filter(p => rd.answers[p.agent_id] === correct)
      .map(p => p.agent_id);

    // Collect stakes
    const totalPot = allPlayers.reduce((s, p) => s + Number(p.chips), 0);
    const split = winners.length ? Math.floor(totalPot / winners.length) : 0;

    for (const wId of winners) {
      await transferCredits(null, wId, split, 'trivia_win', 'Trivia winner payout');
    }

    rd.status = 'finished'; rd.winners = winners; rd.correct_answer = correct;
    await _endRound(tableId, roundId, rd);
  } else {
    await pool.query('UPDATE game_rounds SET outcome = ? WHERE id = ?', [JSON.stringify(rd), roundId]);
  }

  return { data: rd };
}

// ─── End round helper ─────────────────────────────────────────────────────────

async function _endRound(tableId, roundId, rd) {
  await pool.query('UPDATE game_rounds SET outcome = ? WHERE id = ?', [JSON.stringify(rd), roundId]);
  await pool.query(`UPDATE game_tables SET status = 'finished' WHERE id = ?`, [tableId]);
  await pool.query(`UPDATE game_players SET status = 'waiting' WHERE table_id = ?`, [tableId]);
}
