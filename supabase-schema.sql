-- Supabase Schema for Commute Cost Calculator
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Create persons table
CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES persons(id),
  roundtrip_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create commutes table
CREATE TABLE IF NOT EXISTS commutes (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('roundtrip', 'oneway')),
  selected_cars INTEGER[] NOT NULL,
  selected_persons INTEGER[] NOT NULL,
  drivers INTEGER[] NOT NULL,
  price_per_person DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (optional - allows public access)
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE commutes ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (for sharing without login)
CREATE POLICY "Allow public read access on persons" ON persons FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on persons" ON persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on persons" ON persons FOR DELETE USING (true);

CREATE POLICY "Allow public read access on cars" ON cars FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on cars" ON cars FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on cars" ON cars FOR DELETE USING (true);

CREATE POLICY "Allow public read access on commutes" ON commutes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on commutes" ON commutes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on commutes" ON commutes FOR DELETE USING (true);
