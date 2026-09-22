// SUBJECTS used to live here as a fixed array. Subjects are master data
// now - a Subject collection managed from the Subjects page by a Principal
// or Accounts Manager, enabled per branch - so the list is fetched, not
// imported. Use the useSubjects() hook in lib/useSubjects.js.
//
// The names that were in this array seeded the initial catalog; see
// Hive_Backend/src/utils/seedSubjects.js.

// Mirrors GRADES in Hive_Backend/src/models/Class.js exactly, in the same
// order - that enum is what actually accepts or rejects a grade, so any
// entry here that isn't there is a dropdown option the server will refuse.
// (NURSERY was valid server-side from day one but missing from this list,
// which is how it ended up unofferable in half the app.)
export const CLASS_LIST = [
  "PRE-NURSERY",
  "NURSERY",
  "PP1",
  "PP2",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

// How a grade is written wherever one is shown. Numbered grades read as
// "Class 5"; named ones (PRE-NURSERY/NURSERY/PP1/PP2/LKG/UKG) stand alone,
// since "Class PP1" is not a thing anyone says.
//
// Decided on the SHAPE of the value rather than a list of known names.
// This logic used to be an inline check against a hardcoded ["LKG","UKG"]
// array copied into 16 places, so every grade added after those two read
// as "Class NURSERY" - and PP1/PP2 would have joined it. Written this way
// a future named grade needs no change here at all.
export const gradeLabel = (grade) => {
  const g = String(grade ?? "").trim();
  if (!g) return "";
  return /^[0-9]+$/.test(g) ? `Class ${g}` : g;
};

export const TEACHER_ROLES = ["Teacher"];

export const ACADEMIC_YEARS = ["2026-2027", "2027-2028"];

export const CURRENT_ACADEMIC_YEAR = ACADEMIC_YEARS[0];

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

// ---------------------------------------------------------------------------
// Expenditure
//
// All three lists mirror Hive_Backend/src/models/Expenditure.js (category /
// payment_mode enums) and DOCUMENT_CATEGORIES in expenditureController.js.
// They live here rather than inside BPExpenditure.jsx because the bulk-upload
// dialog needs the same values to build the template's dropdowns and to
// validate an uploaded sheet - two copies would drift the moment a category
// is added server-side.
// ---------------------------------------------------------------------------
export const EXPENDITURE_CATEGORIES = [
  "Abacus/Vedic Maths Bills",
  "8th to 10th forwarding expenses",
  "Repairs and Maintenance",
  "Play Equipments",
  "Sports Equipments",
  "Admission Incentives",
  "Advertisements",
  "Bank Deposits",
  "Branch Visiting Allowance",
  "Building Repairs and Maintenance",
  "Building-I Rent",
  "Building-II Rent",
  "Bus Diesel",
  "Bus EMI-I",
  "Bus EMI-II",
  "Bus Fitness and Permit",
  "Bus Insurance",
  "Bus Repairs and Maintenance",
  "Bus Tax",
  "Chit Payments",
  "Class Room Furniture Bills",
  "Consultancy Bills",
  "DCEB Expenses",
  "Donations and Charities",
  "Drinking Water Bills",
  "Electricity Bills",
  "Electrical Equipments",
  "Electrical Repairs and Maintenance",
  "ERP AMC",
  "Functions and Celebrations",
  "Furniture Repairs and Maintenance",
  "Ground Rent",
  "Hire Vehicle Bills",
  "Housekeeping Bills",
  "ID/Badges Bills",
  "Interest on Loans",
  "Loans Repayments",
  "Look and Feel Bills",
  "Magazine Bills",
  "Management Fee",
  "Mobile and Internet Bills",
  "Municipal Water Bills",
  "Note Books Bills",
  "Office Furniture Bills",
  "Office Records Bills",
  "Other Miscellaneous Bills",
  "PF & ESI Payments",
  "Picnic and Tours Expenses",
  "Printing and Stationary Bills",
  "Profit Share",
  "Property Tax Bills",
  "Question Papers Bills",
  "Recognition Express",
  "Regular Uniform Bills",
  "Salaries and Wages",
  "School Activity Bills",
  "School Maintenance",
  "Sports Uniform Bills",
  "SSC Exam Fee Expenses",
  "Staff Welfare Bills",
  "Stationary Bills",
  "Student Diaries Bills",
  "Study and IIT Material Bills",
  "TDS Payments",
  "Text Books Bills",
  "Tie and Belts Bills",
  "Training Program Expenses",
  "Transport and Courier Expenses",
  "Travelling Allowance",
];

export const EXPENDITURE_PAYMENT_MODES = [
  "Cash",
  "Cheque",
  "Bank Transfer",
  "Swipe machine",
  "Paytm",
  "GooglePay",
  "PhonePay",
  "OnlineTransfer",
  "Others",
];

// A document (receipt/bill) can only be attached for these categories.
// Bulk upload never sets a document at all - a spreadsheet has no file to
// attach - so this only governs the Add Expenditure dialog.
export const EXPENDITURE_DOCUMENT_CATEGORIES = [
  "Building-I Rent",
  "Building-II Rent",
  "Bus Diesel",
  "Bus EMI-I",
  "Bus EMI-II",
  "Salaries and Wages",
];
