-- YouTube Music Now Playing - Supabase Setup
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/uczcbonklkmgzdtqeulx/sql/new

-- Create the now_playing table
CREATE TABLE public.now_playing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL DEFAULT '',
  artist text NOT NULL DEFAULT '',
  album text DEFAULT '',
  album_art text DEFAULT '',
  duration text DEFAULT '',
  is_playing boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.now_playing ENABLE ROW LEVEL SECURITY;

-- Public read policy (anyone can see what you're listening to)
CREATE POLICY "Anyone can read now_playing"
  ON public.now_playing
  FOR SELECT
  USING (true);

-- Authenticated user can insert their own row
CREATE POLICY "Users can insert their own now_playing"
  ON public.now_playing
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated user can update their own row
CREATE POLICY "Users can update their own now_playing"
  ON public.now_playing
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime broadcasts for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.now_playing;
