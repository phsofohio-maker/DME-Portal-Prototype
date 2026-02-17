
import { Staff, DMEEquipment } from '../types';

export const MOCK_STAFF: Staff[] = [
  {
    uid: 'admin-1',
    email: 'admin@parrish.com',
    pin: '1234',
    displayName: 'Admin User',
    role: 'admin',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Added missing required property hasCompletedOnboarding
    hasCompletedOnboarding: true,
    // Added missing required property status
    status: 'active'
  },
  {
    uid: 'nurse-1',
    email: 'nurse@parrish.com',
    pin: '1234',
    displayName: 'Sarah Nurse',
    role: 'nurse',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Added missing required property hasCompletedOnboarding
    hasCompletedOnboarding: true,
    // Added missing required property status
    status: 'active'
  }
];

export const MOCK_PATIENTS = [
  {
    id: 'P001', mrn: 'MRN-004821',
    name: 'Margaret Thornton', initials: 'MT', color: '#7c3aed',
    dob: 'Mar 12, 1948', age: 76, sex: 'Female',
    phone: '(512) 555-0142', insurance: 'Medicare Part B', insId: '1EG4-TE5-MK72',
    physician: 'Dr. A. Nguyen', address: '4201 Oak Creek Dr, Austin TX 78731',
    allergies: 'Penicillin', conditions: ['CHF', 'Osteoarthritis']
  },
  {
    id: 'P002', mrn: 'MRN-009314',
    name: 'James R. Holloway', initials: 'JH', color: '#0369a1',
    dob: 'Jun 28, 1955', age: 69, sex: 'Male',
    phone: '(737) 555-0278', insurance: 'Blue Cross Blue Shield', insId: 'XYZ-882-BCBS',
    physician: 'Dr. A. Nguyen', address: '881 Barton Springs Rd, Austin TX 78704',
    allergies: 'None on file', conditions: ['COPD', 'Type 2 Diabetes']
  },
  {
    id: 'P003', mrn: 'MRN-015567',
    name: 'Sofia Reyes-Campos', initials: 'SR', color: '#be185d',
    dob: 'Nov 4, 1972', age: 52, sex: 'Female',
    phone: '(512) 555-0391', insurance: 'Aetna', insId: 'ATN-55129-R',
    physician: 'Dr. A. Nguyen', address: '2340 Lamar Blvd, Austin TX 78705',
    allergies: 'Sulfa, Latex', conditions: ['MS', 'Hypertension']
  },
  {
    id: 'P004', mrn: 'MRN-021984',
    name: 'Robert L. Kim', initials: 'RK', color: '#0f766e',
    dob: 'Feb 17, 1940', age: 85, sex: 'Male',
    phone: '(512) 555-0507', insurance: 'Medicare Part B', insId: '2KM7-AB3-TT01',
    physician: 'Dr. A. Nguyen', address: '109 West 6th St, Austin TX 78701',
    allergies: 'Aspirin', conditions: ['Parkinson\'s', 'Hip fracture (post-op)']
  },
  {
    id: 'P005', mrn: 'MRN-033210',
    name: 'Linda J. Okafor', initials: 'LO', color: '#b45309',
    dob: 'Sep 1, 1961', age: 63, sex: 'Female',
    phone: '(737) 555-0644', insurance: 'UnitedHealthcare', insId: 'UHC-44980-LO',
    physician: 'Dr. A. Nguyen', address: '560 Congress Ave, Austin TX 78701',
    allergies: 'None on file', conditions: ['Stroke (recovery)', 'Obesity']
  },
];

export const MOCK_DME: DMEEquipment[] = [
  // BATHROOM SAFETY
  { id: 'b1', itemName: 'Commode', sku: 'BATH-COM-001', category: 'Bathroom Safety' },
  { id: 'b2', itemName: 'Commode 3 in 1 - LTC', sku: 'BATH-COM-002', category: 'Bathroom Safety' },
  { id: 'b3', itemName: 'Commode Bariatric', sku: 'BATH-COM-BARI-01', category: 'Bathroom Safety' },
  { id: 'b4', itemName: 'Commode Drop Arm', sku: 'BATH-COM-DA-01', category: 'Bathroom Safety' },
  { id: 'b5', itemName: 'Commode Extra Wide', sku: 'BATH-COM-EW-01', category: 'Bathroom Safety' },
  { id: 'b6', itemName: 'Commode Heavy Duty', sku: 'BATH-COM-HD-01', category: 'Bathroom Safety' },
  { id: 'b7', itemName: 'Commode pail', sku: 'BATH-COM-PAIL', category: 'Bathroom Safety' },
  { id: 'b8', itemName: 'Commode splash guard', sku: 'BATH-COM-SG-01', category: 'Bathroom Safety' },

  // BEDS & MATTRESSES
  { id: 'm1', itemName: 'Alternating pressure pad', sku: 'BED-ACC-APP-01', category: 'Beds & Mattresses' },
  { id: 'm2', itemName: 'Bed Alarm', sku: 'BED-ALARM-SYS', category: 'Beds & Mattresses' },
  { id: 'm3', itemName: 'Bed Alarm Pad', sku: 'BED-ALARM-PAD', category: 'Beds & Mattresses' },
  { id: 'm4', itemName: 'Bed Alarm: Pad Monitor w/ Pad', sku: 'BED-ALARM-UNIT', category: 'Beds & Mattresses' },
  { id: 'm5', itemName: 'Bed Extension Kit', sku: 'BED-EXT-KIT', category: 'Beds & Mattresses' },
  { id: 'm6', itemName: 'Bed Bariatric', sku: 'BED-FRAME-BARI', category: 'Beds & Mattresses' },
  { id: 'm7', itemName: 'Bed Full Electric', sku: 'BED-FRAME-FE-01', category: 'Beds & Mattresses' },
  { id: 'm8', itemName: 'Bed High-Low Full Electric', sku: 'BED-FRAME-HL-01', category: 'Beds & Mattresses' },
  { id: 'm9', itemName: 'Bed - Bari Full Electric HD"', sku: 'BED-FRAME-HD-BARI', category: 'Beds & Mattresses' },
  { id: 'm10', itemName: 'Bed Mattress Extra Long', sku: 'BED-MAT-XL', category: 'Beds & Mattresses' },
  { id: 'm11', itemName: 'Bed Mattress - Gel Overlay', sku: 'BED-MAT-GEL', category: 'Beds & Mattresses' },
  { id: 'm12', itemName: 'Bed Mattress - Group 1 Premium', sku: 'BED-MAT-G1P', category: 'Beds & Mattresses' },
  { id: 'm13', itemName: 'Bed Mattress - Group 1 Premium w/ Wings', sku: 'BED-MAT-G1PW', category: 'Beds & Mattresses' },
  { id: 'm14', itemName: 'ALTERNATING PRESSURE MATTRESS AND PUMP (APM))', sku: 'BED-SYS-APM', category: 'Beds & Mattresses' },
  { id: 'm15', itemName: 'Alternating Pressure Mattress Bariatric', sku: 'BED-SYS-APM-BARI', category: 'Beds & Mattresses' },
  { id: 'm16', itemName: 'Alternating Pressure Mattress w/Wings', sku: 'BED-SYS-APMW', category: 'Beds & Mattresses' },
  { id: 'm17', itemName: 'Bariatric Low Air Loss Mattress and Pump (BARI LAL) 48"', sku: 'BED-SYS-LAL-48', category: 'Beds & Mattresses' },
  { id: 'm18', itemName: 'Drive Low Air Loss Mattress', sku: 'BED-SYS-LAL-DRV', category: 'Beds & Mattresses' },
  { id: 'm19', itemName: 'LAL/APM Mattress', sku: 'BED-SYS-LAL-COMB', category: 'Beds & Mattresses' },
  { id: 'm20', itemName: 'Low Air Loss - Bariatric Mattress', sku: 'BED-SYS-LAL-BARI', category: 'Beds & Mattresses' },
  { id: 'm21', itemName: 'Drive Bariatric Alternating Pressure Mattress / Pump (BARI APM)', sku: 'BED-SYS-APM-DRV', category: 'Beds & Mattresses' },
  { id: 'm22', itemName: 'Geo Mattress Group 1', sku: 'BED-MAT-GEO-G1', category: 'Beds & Mattresses' },

  // MOBILITY
  { id: 'w1', itemName: 'BRODA Chair 16"', sku: 'MOB-BRODA-16', category: 'Mobility' },
  { id: 'w2', itemName: 'BRODA Pedal Chair 18"', sku: 'MOB-BRODA-18', category: 'Mobility' },
  { id: 'w3', itemName: 'BRODA Pedal Chair 20"', sku: 'MOB-BRODA-20', category: 'Mobility' },
  { id: 'w4', itemName: 'BRODA Pedal Chair 22"', sku: 'MOB-BRODA-22', category: 'Mobility' },
  { id: 'w5', itemName: 'Broda Midline Tilt Recliner 22"', sku: 'MOB-BRODA-TILT-22', category: 'Mobility' },
  { id: 'w6', itemName: 'Cane quad', sku: 'MOB-CANE-QUAD', category: 'Mobility' },
  { id: 'w7', itemName: 'Cane - Single Point Straight', sku: 'MOB-CANE-SP', category: 'Mobility' },
  { id: 'w8', itemName: 'Folding Walker W/Out Wheels', sku: 'MOB-WALK-FOLD', category: 'Mobility' },
  { id: 'w9', itemName: 'Folding Walker With Wheels', sku: 'MOB-WALK-WHEEL', category: 'Mobility' },
  { id: 'w10', itemName: '4 Wheeled walker', sku: 'MOB-WALK-4W', category: 'Mobility' },
  { id: 'w11', itemName: 'Geri Chair', sku: 'MOB-GERI-CHAIR', category: 'Mobility' },

  // PATIENT CARE
  { id: 'c1', itemName: 'Bed Bolster Cushion', sku: 'CARE-BED-BOLST', category: 'Patient Care' },
  { id: 'c2', itemName: 'Bed Cradle Foot Support', sku: 'CARE-BED-CRAD-FT', category: 'Patient Care' },
  { id: 'c3', itemName: 'Bed Rail Pads', sku: 'CARE-BED-RAIL-PAD', category: 'Patient Care' },
  { id: 'c4', itemName: 'Bed Rails Full Length', sku: 'CARE-BED-RAIL-FL', category: 'Patient Care' },
  { id: 'c5', itemName: 'Bed Rails Half Length', sku: 'CARE-BED-RAIL-HL', category: 'Patient Care' },
  { id: 'c6', itemName: 'Bed wedge', sku: 'CARE-BED-WEDGE', category: 'Patient Care' },
  { id: 'c7', itemName: 'Fall pad', sku: 'CARE-FALL-PAD', category: 'Patient Care' },
  { id: 'c8', itemName: 'Feeding Pump', sku: 'CARE-FEED-PUMP', category: 'Patient Care' },
  { id: 'c9', itemName: 'Gait Belt', sku: 'CARE-GAIT-BELT', category: 'Patient Care' },
  { id: 'c10', itemName: 'Gap Filler', sku: 'CARE-GAP-FILL', category: 'Patient Care' },
  { id: 'c11', itemName: 'Heel Pillow', sku: 'CARE-HEEL-PIL', category: 'Patient Care' },
  { id: 'c12', itemName: 'Heel Protector (pair)', sku: 'CARE-HEEL-PROT', category: 'Patient Care' },
  { id: 'c13', itemName: 'IV Pole', sku: 'CARE-IV-POLE', category: 'Patient Care' },
  { id: 'c14', itemName: 'Lap buddy', sku: 'CARE-LAP-BUDDY', category: 'Patient Care' },
  { id: 'c15', itemName: 'Lateral Support for Wheelchair', sku: 'CARE-WC-LATERAL', category: 'Patient Care' },
  { id: 'c16', itemName: 'Leg Rests', sku: 'CARE-WC-LEG-REST', category: 'Patient Care' },

  // PATIENT LIFTS
  { id: 'l1', itemName: 'Electric Patient Lift', sku: 'LIFT-ELEC-01', category: 'Patient Lifts' },
  { id: 'l2', itemName: 'Electric Sit to Stand Lift', sku: 'LIFT-STS-ELEC', category: 'Patient Lifts' },
  { id: 'l3', itemName: 'HOYER DLX POWER PATIENT LIFT', sku: 'LIFT-HOYER-PWR', category: 'Patient Lifts' },
  { id: 'l4', itemName: 'Hoyer lift - Unit', sku: 'LIFT-HOYER-UNIT', category: 'Patient Lifts' },
  { id: 'l5', itemName: 'Hoyer Lift - U Sling (Small)', sku: 'LIFT-SLING-S', category: 'Patient Lifts' },
  { id: 'l6', itemName: 'Hoyer Lift - U Sling (Medium)', sku: 'LIFT-SLING-M', category: 'Patient Lifts' },
  { id: 'l7', itemName: 'Hoyer Lift - U Sling (Large)', sku: 'LIFT-SLING-L', category: 'Patient Lifts' },

  // RESPIRATORY
  { id: 'r1', itemName: '10L Oxygen Concentrator with Backup', sku: 'RESP-CONC-10L', category: 'Respiratory' },
  { id: 'r2', itemName: '5L Oxygen Concentrator with Backup', sku: 'RESP-CONC-5L', category: 'Respiratory' },
  { id: 'r3', itemName: 'Concentrator Portable', sku: 'RESP-CONC-PORT', category: 'Respiratory' },
  { id: 'r4', itemName: '50 PSI Air Compressor', sku: 'RESP-COMP-50', category: 'Respiratory' },
  { id: 'r5', itemName: 'BIPAP', sku: 'RESP-PAP-BIPAP', category: 'Respiratory' },
  { id: 'r6', itemName: 'BiPAP ST', sku: 'RESP-PAP-BIPAP-ST', category: 'Respiratory' },
  // Fixed: removed redundant entry with invalid property 'apothecary' at original line 158
  { id: 'r7', itemName: 'CPAP', sku: 'RESP-PAP-CPAP', category: 'Respiratory' },
  { id: 'r8', itemName: 'DISPOSABLE NEBULIZER KIT', sku: 'RESP-NEB-KIT', category: 'Respiratory' },
  { id: 'r9', itemName: 'Gastric Suction Machine', sku: 'RESP-SUCT-01', category: 'Respiratory' },
  { id: 'r10', itemName: 'Home fill System with 2 Tanks', sku: 'RESP-O2-FILL', category: 'Respiratory' },
  { id: 'r11', itemName: '25ft O2 Tubing', sku: 'RESP-TUBE-25', category: 'Respiratory' },
  { id: 'r12', itemName: '50ft tubing', sku: 'RESP-TUBE-50', category: 'Respiratory' },
  { id: 'r13', itemName: 'E Cylinder Cart', sku: 'RESP-O2-CART', category: 'Respiratory' }
];
