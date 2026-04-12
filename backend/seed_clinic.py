"""
Seed script: creates and populates a clinic schema directly in the Neon database.
Run from the backend/ directory:  python seed_clinic.py
"""
import asyncio
import asyncpg

CONN = "postgresql://neondb_owner:npg_OqIZz78fMSmY@ep-spring-shadow-anr6apyz.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"

SCHEMA = """
DROP TABLE IF EXISTS prescriptions   CASCADE;
DROP TABLE IF EXISTS diagnoses        CASCADE;
DROP TABLE IF EXISTS visits           CASCADE;
DROP TABLE IF EXISTS appointments     CASCADE;
DROP TABLE IF EXISTS patients         CASCADE;
DROP TABLE IF EXISTS doctors          CASCADE;
DROP TABLE IF EXISTS departments      CASCADE;

CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    floor       INTEGER,
    phone_ext   VARCHAR(10)
);

CREATE TABLE doctors (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    specialty     VARCHAR(100),
    department_id INTEGER REFERENCES departments(id),
    email         VARCHAR(120),
    license_no    VARCHAR(30),
    hired_at      DATE
);

CREATE TABLE patients (
    id             SERIAL PRIMARY KEY,
    full_name      VARCHAR(120) NOT NULL,
    date_of_birth  DATE,
    gender         VARCHAR(10),
    phone          VARCHAR(20),
    email          VARCHAR(120),
    address        TEXT,
    blood_type     VARCHAR(5),
    allergies      TEXT,
    registered_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE appointments (
    id             SERIAL PRIMARY KEY,
    patient_id     INTEGER REFERENCES patients(id),
    doctor_id      INTEGER REFERENCES doctors(id),
    scheduled_at   TIMESTAMP NOT NULL,
    duration_min   INTEGER DEFAULT 30,
    status         VARCHAR(20) DEFAULT 'scheduled',
    reason         TEXT,
    notes          TEXT,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE visits (
    id              SERIAL PRIMARY KEY,
    appointment_id  INTEGER REFERENCES appointments(id),
    patient_id      INTEGER REFERENCES patients(id),
    doctor_id       INTEGER REFERENCES doctors(id),
    visited_at      TIMESTAMP NOT NULL,
    chief_complaint TEXT,
    diagnosis       TEXT,
    diagnosis_notes TEXT,
    follow_up_days  INTEGER,
    weight_kg       NUMERIC(5,1),
    bp_systolic     INTEGER,
    bp_diastolic    INTEGER,
    temperature_c   NUMERIC(4,1)
);

CREATE TABLE diagnoses (
    id             SERIAL PRIMARY KEY,
    visit_id       INTEGER REFERENCES visits(id),
    patient_id     INTEGER REFERENCES patients(id),
    icd_code       VARCHAR(20),
    description    TEXT NOT NULL,
    severity       VARCHAR(20) DEFAULT 'mild',
    follow_up_days INTEGER
);

CREATE TABLE prescriptions (
    id             SERIAL PRIMARY KEY,
    visit_id       INTEGER REFERENCES visits(id),
    patient_id     INTEGER REFERENCES patients(id),
    medication     VARCHAR(120) NOT NULL,
    dosage         VARCHAR(80),
    frequency      VARCHAR(60),
    duration_days  INTEGER,
    notes          TEXT,
    prescribed_at  TIMESTAMP DEFAULT NOW()
);
"""

DATA = """
INSERT INTO departments (name, floor, phone_ext) VALUES
  ('General Practice', 1, '101'),
  ('Cardiology',       2, '201'),
  ('Pediatrics',       1, '102'),
  ('Orthopedics',      3, '301'),
  ('Dermatology',      2, '202');

INSERT INTO doctors (full_name, specialty, department_id, email, license_no, hired_at) VALUES
  ('Dr. Emily Chen',    'General Practice',  1, 'e.chen@yunoclinic.com',    'GP-10021', '2018-03-15'),
  ('Dr. Marcus Webb',   'Cardiologist',      2, 'm.webb@yunoclinic.com',    'CA-20045', '2015-07-01'),
  ('Dr. Aisha Patel',   'Pediatrician',      3, 'a.patel@yunoclinic.com',   'PE-30012', '2020-01-10'),
  ('Dr. James Rowan',   'Orthopedic Surgeon',4, 'j.rowan@yunoclinic.com',   'OR-40033', '2012-09-22'),
  ('Dr. Sofia Navarro', 'Dermatologist',     5, 's.navarro@yunoclinic.com', 'DE-50009', '2019-06-18');

INSERT INTO patients (full_name, date_of_birth, gender, phone, email, address, blood_type, allergies, registered_at) VALUES
  ('Sarah Johnson',   '1990-05-15', 'Female', '555-0101', 'sarah.j@email.com',    '12 Oak St, Springfield',    'A+',  'Penicillin',         '2022-01-10 09:00:00'),
  ('Michael Torres',  '1975-11-23', 'Male',   '555-0102', 'mtorres@email.com',    '45 Maple Ave, Shelbyville', 'O-',  NULL,                 '2021-06-05 10:30:00'),
  ('Emma Williams',   '2015-03-08', 'Female', '555-0103', 'ewilliams@email.com',  '78 Pine Rd, Springfield',   'B+',  'Sulfa drugs',        '2023-03-01 11:00:00'),
  ('David Kim',       '1988-07-30', 'Male',   '555-0104', 'd.kim@email.com',      '9 Elm St, Capital City',    'AB+', NULL,                 '2020-09-14 14:00:00'),
  ('Lisa Martinez',   '1965-02-19', 'Female', '555-0105', 'lmartinez@email.com',  '33 Cedar Ln, Shelbyville',  'O+',  'Aspirin, Ibuprofen', '2019-11-20 08:30:00'),
  ('James Park',      '1999-12-01', 'Male',   '555-0106', 'jpark@email.com',      '21 Birch Blvd, Springfield','A-',  NULL,                 '2023-07-22 15:00:00'),
  ('Olivia Brown',    '2010-08-17', 'Female', '555-0107', 'obrown@email.com',     '67 Spruce Way, Capital City','B-', 'Latex',              '2022-05-11 09:45:00'),
  ('Robert Davis',    '1952-04-04', 'Male',   '555-0108', 'rdavis@email.com',     '5 Walnut Dr, Springfield',  'A+',  'Codeine',            '2018-02-28 13:15:00'),
  ('Chloe Anderson',  '2003-09-25', 'Female', '555-0109', 'c.anderson@email.com', '14 Ash Ct, Shelbyville',    'O+',  NULL,                 '2024-01-08 10:00:00'),
  ('William Nguyen',  '1980-06-12', 'Male',   '555-0110', 'wng@email.com',        '88 Poplar St, Capital City','AB-', 'Shellfish',          '2021-03-17 16:30:00');

INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_min, status, reason) VALUES
  (1, 1, NOW() - INTERVAL '60 days', 30, 'completed', 'Annual checkup'),
  (2, 2, NOW() - INTERVAL '55 days', 45, 'completed', 'Chest pain follow-up'),
  (3, 3, NOW() - INTERVAL '50 days', 30, 'completed', 'Routine pediatric visit'),
  (4, 4, NOW() - INTERVAL '45 days', 60, 'completed', 'Knee pain evaluation'),
  (5, 1, NOW() - INTERVAL '40 days', 30, 'completed', 'Blood pressure review'),
  (6, 5, NOW() - INTERVAL '30 days', 30, 'completed', 'Skin rash consultation'),
  (7, 3, NOW() - INTERVAL '25 days', 30, 'completed', 'Vaccination'),
  (8, 2, NOW() - INTERVAL '20 days', 45, 'completed', 'ECG follow-up'),
  (9, 1, NOW() - INTERVAL '14 days', 30, 'completed', 'Cold and fever'),
  (10,4, NOW() - INTERVAL '10 days', 60, 'completed', 'Shoulder injury'),
  (1, 1, NOW() - INTERVAL '7 days',  30, 'completed', 'Lab results review'),
  (5, 2, NOW() - INTERVAL '3 days',  45, 'completed', 'Hypertension management'),
  (2, 2, NOW() + INTERVAL '3 days',  45, 'scheduled', 'Quarterly cardiac review'),
  (3, 3, NOW() + INTERVAL '5 days',  30, 'scheduled', 'Growth checkup'),
  (6, 5, NOW() + INTERVAL '10 days', 30, 'cancelled', 'Acne treatment follow-up'),
  (9, 1, NOW() - INTERVAL '2 days',  30, 'no-show',   'Follow-up consultation');

INSERT INTO visits (appointment_id, patient_id, doctor_id, visited_at, chief_complaint, diagnosis, diagnosis_notes, follow_up_days, weight_kg, bp_systolic, bp_diastolic, temperature_c) VALUES
  (1,  1, 1, NOW()-INTERVAL '60 days', 'Annual checkup',      'Healthy — no concerns',             'All vitals normal. Increased water intake advised.',         365, 62.5, 118, 76, 36.6),
  (2,  2, 2, NOW()-INTERVAL '55 days', 'Chest pain',          'Stable angina',                     'Stress ECG ordered. Low-sodium diet advised.',                30, 88.0, 145, 92, 36.8),
  (3,  3, 3, NOW()-INTERVAL '50 days', 'Routine visit',       'Healthy development',               'Growth on 60th percentile. MMR booster given.',              180, 18.2, 100, 65, 36.5),
  (4,  4, 4, NOW()-INTERVAL '45 days', 'Knee pain',           'Medial meniscus tear (mild)',        'MRI confirmed partial tear. PT referred.',                    14, 74.0, 122, 80, 36.7),
  (5,  5, 1, NOW()-INTERVAL '40 days', 'BP review',           'Stage 1 hypertension',              'Medication adjusted. Low-sodium diet reinforced.',             30, 70.5, 148, 94, 36.6),
  (6,  6, 5, NOW()-INTERVAL '30 days', 'Skin rash',           'Contact dermatitis',                'Topical corticosteroid prescribed. Avoid irritants.',           7, 68.0, 115, 74, 36.5),
  (7,  7, 3, NOW()-INTERVAL '25 days', 'Vaccination',         'Healthy child',                     'Flu and varicella vaccines administered.',                    365, 32.0,  98, 62, 36.4),
  (8,  8, 2, NOW()-INTERVAL '20 days', 'ECG follow-up',       'Atrial fibrillation (stable)',      'Anticoagulant maintained. Holter in 6 months.',               90, 82.0, 138, 88, 36.9),
  (9,  9, 1, NOW()-INTERVAL '14 days', 'Cold and fever',      'Viral upper respiratory infection', 'Rest, fluids, paracetamol. No antibiotics needed.',             7, 55.0, 110, 70, 38.2),
  (10,10, 4, NOW()-INTERVAL '10 days', 'Shoulder injury',     'Rotator cuff strain',               'Ice, NSAIDs, PT exercises. Review in 2 weeks.',               14, 79.0, 125, 82, 36.6),
  (11, 1, 1, NOW()-INTERVAL '7 days',  'Lab results',         'Mild iron deficiency anemia',       'Iron supplement started. Recheck CBC in 3 months.',           90, 62.5, 116, 75, 36.5),
  (12, 5, 2, NOW()-INTERVAL '3 days',  'Hypertension review', 'Hypertension — controlled',         'BP improved on current regimen. Continue medication.',         30, 70.2, 135, 86, 36.6);

INSERT INTO diagnoses (visit_id, patient_id, icd_code, description, severity, follow_up_days) VALUES
  (2,  2,  'I20.9',   'Angina pectoris, unspecified',             'moderate', 30),
  (5,  5,  'I10',     'Essential hypertension',                   'moderate', 30),
  (6,  6,  'L23.9',   'Contact dermatitis, unspecified',          'mild',      7),
  (8,  8,  'I48.91',  'Unspecified atrial fibrillation',          'moderate', 90),
  (9,  9,  'J06.9',   'Acute upper respiratory infection',        'mild',      7),
  (10,10,  'M75.1',   'Rotator cuff syndrome',                    'mild',     14),
  (11, 1,  'D50.9',   'Iron deficiency anemia, unspecified',      'mild',     90),
  (12, 5,  'I10',     'Essential hypertension — controlled',      'mild',     30);

INSERT INTO prescriptions (visit_id, patient_id, medication, dosage, frequency, duration_days, notes) VALUES
  (2,  2,  'Nitroglycerin',        '0.4 mg',  'As needed (chest pain)',         90,  'Sublingual. Call 911 if no relief after 5 min.'),
  (2,  2,  'Aspirin',              '81 mg',   'Once daily',                    365,  'Take with food. Low-dose cardioprotective.'),
  (5,  5,  'Amlodipine',           '5 mg',    'Once daily',                     30,  'Same time each day. Monitor for ankle swelling.'),
  (6,  6,  'Hydrocortisone cream', '1%',      'Twice daily (thin layer)',         7,  'Apply to affected area only. Avoid face.'),
  (8,  8,  'Warfarin',             '5 mg',    'Once daily',                     90,  'INR check in 4 weeks. Avoid NSAIDs.'),
  (9,  9,  'Paracetamol',          '500 mg',  'Every 6 hours as needed',         5,  'Max 4 doses/day. Drink plenty of fluids.'),
  (10,10,  'Ibuprofen',            '400 mg',  'Three times daily with food',    14,  'Take with meals. Ice shoulder 20 min 3x/day.'),
  (11, 1,  'Ferrous sulfate',      '325 mg',  'Once daily',                     90,  'Take on empty stomach. May cause dark stools.');
"""


async def main():
    print("Connecting to Neon...")
    conn = await asyncpg.connect(CONN)

    print("Creating schema...")
    await conn.execute(SCHEMA)

    print("Inserting data...")
    await conn.execute(DATA)

    # Quick row counts
    tables = ["departments", "doctors", "patients", "appointments", "visits", "diagnoses", "prescriptions"]
    print("\nSeeded successfully:")
    for t in tables:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {t}")
        print(f"  {t:<16} {count} rows")

    await conn.close()
    print("\nDone. Connect your app with this connection string and it will introspect all 7 tables.")


asyncio.run(main())
