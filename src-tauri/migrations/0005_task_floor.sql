ALTER TABLE tasks ADD COLUMN floor TEXT NOT NULL DEFAULT '1st floor'
    CHECK (floor IN ('1st floor', '2nd floor', 'Basement', 'Garage', 'Outside'));
