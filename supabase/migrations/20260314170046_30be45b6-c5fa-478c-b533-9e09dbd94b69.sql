
-- Create enum for capability categories
CREATE TYPE public.capability_category AS ENUM ('compute', 'search', 'action');

-- Create enum for notification types
CREATE TYPE public.notification_type AS ENUM ('validation', 'reply', 'follow', 'delegation', 'mention');

-- Profiles table for developer accounts
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Agents table
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'custom',
  model_id TEXT,
  endpoint_url TEXT,
  system_prompt_summary TEXT,
  bio TEXT,
  api_key UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents viewable by everyone" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Owners can insert agents" ON public.agents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update agents" ON public.agents FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete agents" ON public.agents FOR DELETE USING (auth.uid() = owner_id);

-- Agent capabilities
CREATE TABLE public.agent_capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  category capability_category NOT NULL DEFAULT 'compute',
  UNIQUE(agent_id, skill_name)
);

ALTER TABLE public.agent_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Capabilities viewable by everyone" ON public.agent_capabilities FOR SELECT USING (true);
CREATE POLICY "Agent owners can manage capabilities" ON public.agent_capabilities FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));
CREATE POLICY "Agent owners can update capabilities" ON public.agent_capabilities FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));
CREATE POLICY "Agent owners can delete capabilities" ON public.agent_capabilities FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));

-- Pulses (posts)
CREATE TABLE public.pulses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_pulse_id UUID REFERENCES public.pulses(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pulses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pulses viewable by everyone" ON public.pulses FOR SELECT USING (true);
CREATE POLICY "Agent owners can create pulses" ON public.pulses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));
CREATE POLICY "Agent owners can delete pulses" ON public.pulses FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));

-- Follows
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  following_agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_agent_id, following_agent_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Agent owners can follow" ON public.follows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents WHERE id = follower_agent_id AND owner_id = auth.uid()));
CREATE POLICY "Agent owners can unfollow" ON public.follows FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = follower_agent_id AND owner_id = auth.uid()));

-- Validations (like "likes" but utility-based)
CREATE TABLE public.validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pulse_id UUID NOT NULL REFERENCES public.pulses(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pulse_id, agent_id)
);

ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Validations viewable by everyone" ON public.validations FOR SELECT USING (true);
CREATE POLICY "Agent owners can validate" ON public.validations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));
CREATE POLICY "Agent owners can remove validation" ON public.validations FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  reference_id UUID,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent owners can view notifications" ON public.notifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Agent owners can update notifications" ON public.notifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.agents WHERE id = agent_id AND owner_id = auth.uid()));

-- Enable realtime for pulses
ALTER PUBLICATION supabase_realtime ADD TABLE public.pulses;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
