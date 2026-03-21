import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits, assertOwnership } from './creditService.js';

const BUILD_COSTS   = { marketplace_hub: 200, office_tower: 500, residential_block: 150, warehouse: 100 };
const UPGRADE_COST_MULT = 1.5; // each level costs 1.5x base

export async function handleRealEstateAction(params, userId) {
  const { action } = params;
  switch (action) {
    case 'buy_plot':         return buyPlot(params, userId);
    case 'build_structure':  return buildStructure(params, userId);
    case 'upgrade_building': return upgradeBuilding(params, userId);
    case 'sell_plot':        return sellPlot(params, userId);
    default:
      throw Object.assign(new Error(`Unknown real-estate action: ${action}`), { status: 400 });
  }
}

async function buyPlot({ plotId, buyerAgentId }, userId) {
  if (!plotId || !buyerAgentId) throw Object.assign(new Error('plotId and buyerAgentId required.'), { status: 400 });
  await assertOwnership(buyerAgentId, userId);

  const [[plot]] = await pool.query('SELECT * FROM land_plots WHERE id = ?', [plotId]);
  if (!plot) throw Object.assign(new Error('Plot not found.'), { status: 404 });
  if (plot.owner_agent_id) throw Object.assign(new Error('Plot is already owned.'), { status: 409 });

  await transferCredits(buyerAgentId, null, Number(plot.price), 'plot_purchase', `Buy plot ${plot.plot_id}`);
  await pool.query('UPDATE land_plots SET owner_agent_id = ? WHERE id = ?', [buyerAgentId, plotId]);

  const [[updated]] = await pool.query('SELECT * FROM land_plots WHERE id = ?', [plotId]);
  return { data: updated };
}

async function buildStructure({ plotId, buyerAgentId, buildingType, district }, userId) {
  if (!plotId || !buyerAgentId) throw Object.assign(new Error('plotId and buyerAgentId required.'), { status: 400 });
  await assertOwnership(buyerAgentId, userId);

  const [[plot]] = await pool.query('SELECT * FROM land_plots WHERE id = ?', [plotId]);
  if (!plot) throw Object.assign(new Error('Plot not found.'), { status: 404 });
  if (plot.owner_agent_id !== buyerAgentId) throw Object.assign(new Error('You do not own this plot.'), { status: 403 });

  const [[existing]] = await pool.query('SELECT id FROM plot_buildings WHERE plot_id = ?', [plotId]);
  if (existing) throw Object.assign(new Error('Plot already has a building.'), { status: 409 });

  const type = buildingType || 'marketplace_hub';
  const cost = BUILD_COSTS[type] || 200;
  await transferCredits(buyerAgentId, null, cost, 'build_structure', `Build ${type} on ${plot.plot_id}`);

  const buildingId = uuidv4();
  await pool.query(
    'INSERT INTO plot_buildings (id, plot_id, building_type, level) VALUES (?, ?, ?, 1)',
    [buildingId, plotId, type]
  );

  // Increase daily yield
  await pool.query(
    'UPDATE land_plots SET daily_yield = daily_yield + 5 WHERE id = ?', [plotId]
  );

  const [[building]] = await pool.query('SELECT * FROM plot_buildings WHERE id = ?', [buildingId]);
  return { data: building };
}

async function upgradeBuilding({ plotId, buyerAgentId }, userId) {
  if (!plotId || !buyerAgentId) throw Object.assign(new Error('plotId and buyerAgentId required.'), { status: 400 });
  await assertOwnership(buyerAgentId, userId);

  const [[plot]] = await pool.query('SELECT * FROM land_plots WHERE id = ?', [plotId]);
  if (!plot || plot.owner_agent_id !== buyerAgentId) throw Object.assign(new Error('Not your plot.'), { status: 403 });

  const [[building]] = await pool.query('SELECT * FROM plot_buildings WHERE plot_id = ?', [plotId]);
  if (!building) throw Object.assign(new Error('No building on this plot yet.'), { status: 404 });

  const baseCost = BUILD_COSTS[building.building_type] || 200;
  const upgradeCost = Math.floor(baseCost * Math.pow(UPGRADE_COST_MULT, building.level));

  await transferCredits(buyerAgentId, null, upgradeCost, 'upgrade_building',
    `Upgrade ${building.building_type} on ${plot.plot_id} to level ${building.level + 1}`);

  await pool.query('UPDATE plot_buildings SET level = level + 1 WHERE id = ?', [building.id]);
  await pool.query('UPDATE land_plots SET daily_yield = daily_yield + ? WHERE id = ?',
    [Math.floor(building.level * 2), plotId]
  );

  const [[updated]] = await pool.query('SELECT * FROM plot_buildings WHERE id = ?', [building.id]);
  return { data: updated };
}

async function sellPlot({ plotId, buyerAgentId, price }, userId) {
  if (!plotId || !buyerAgentId) throw Object.assign(new Error('plotId and buyerAgentId required.'), { status: 400 });
  await assertOwnership(buyerAgentId, userId);

  const [[plot]] = await pool.query('SELECT * FROM land_plots WHERE id = ?', [plotId]);
  if (!plot || plot.owner_agent_id !== buyerAgentId) throw Object.assign(new Error('Not your plot.'), { status: 403 });

  const newPrice = Number(price || plot.price);
  await pool.query('UPDATE land_plots SET price = ?, owner_agent_id = NULL WHERE id = ?', [newPrice, plotId]);

  return { data: { listed: true, plot_id: plotId, new_price: newPrice } };
}
