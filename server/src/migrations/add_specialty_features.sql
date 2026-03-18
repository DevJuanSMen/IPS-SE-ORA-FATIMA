ALTER TABLE specialties ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3B82F6';
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS specialty_id UUID REFERENCES specialties(id) ON DELETE CASCADE;

-- Default colors for existing ones based on name
UPDATE specialties SET color = '#10B981' WHERE name ILIKE '%Fisioterapia%';
UPDATE specialties SET color = '#8B5CF6' WHERE name ILIKE '%Ecograf%';
UPDATE specialties SET color = '#F43F5E' WHERE name ILIKE '%Odontolog%';
UPDATE specialties SET color = '#3B82F6' WHERE name ILIKE '%Medicina General%';
UPDATE specialties SET color = '#F59E0B' WHERE name ILIKE '%Radiograf%';
