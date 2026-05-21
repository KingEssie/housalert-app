-- Add rooms_decimal column to store fractional room counts (e.g. 2.5 Zimmer)
-- The integer bedrooms column continues to hold floor(rooms_decimal) for backward compatibility.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS rooms_decimal NUMERIC(3,1);

-- Back-fill existing rows from the integer bedrooms column so queries that
-- prefer rooms_decimal always find a value for existing listings.
UPDATE listings
  SET rooms_decimal = bedrooms::NUMERIC
  WHERE rooms_decimal IS NULL AND bedrooms IS NOT NULL AND bedrooms > 0;
