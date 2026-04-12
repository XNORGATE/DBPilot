-- Test upload file — intentionally contains a few mistakes for AI to catch
-- Errors planted:
--   1. Table "patient" should be "patients"
--   2. Column "name" should be "full_name"
--   3. Column "dob" should be "date_of_birth"
--   4. Appointment insert references column "doctor" instead of "doctor_id"
--   5. Status value typo: "complete" instead of "completed"

INSERT INTO patient (name, dob, gender, phone, email, blood_type)
VALUES
  ('Anna Kowalski',  '1993-04-22', 'Female', '555-0201', 'anna.k@email.com', 'A+'),
  ('Ben Carter',     '1987-09-10', 'Male',   '555-0202', 'ben.c@email.com',  'B+');

INSERT INTO appointments (patient_id, doctor, scheduled_at, duration_min, status, reason)
VALUES
  (11, 1, NOW() + INTERVAL '2 days',  30, 'complete',  'New patient intake'),
  (12, 3, NOW() + INTERVAL '4 days',  30, 'scheduled', 'Skin checkup');
