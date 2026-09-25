import type { AssetCondition, AssetStatus, AssignmentStatus, EmploymentStatus, MaintenanceStatus, TransferStatus, StockTxType, InventoryTxType, LocationType, CategoryGroup, TrackingMode, UserStatus } from "@/generated/prisma";

export type Option = { value: string; label: string };

/** Unified badge tone used across the app. */
export type Tone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "purple"
  | "cyan";

export const ASSET_STATUS: Record<AssetStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Available", tone: "success" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  IN_STORAGE: { label: "In Storage", tone: "muted" },
  UNDER_MAINTENANCE: { label: "Under Maintenance", tone: "warning" },
  DAMAGED: { label: "Damaged", tone: "danger" },
  LOST: { label: "Lost", tone: "danger" },
  STOLEN: { label: "Stolen", tone: "danger" },
  FOR_REPAIR: { label: "For Repair", tone: "warning" },
  RETIRED: { label: "Retired", tone: "muted" },
  DISPOSED: { label: "Disposed", tone: "muted" },
  TRANSFERRED: { label: "Transferred", tone: "purple" },
};

export const ASSET_CONDITION: Record<AssetCondition, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "success" },
  EXCELLENT: { label: "Excellent", tone: "success" },
  GOOD: { label: "Good", tone: "info" },
  FAIR: { label: "Fair", tone: "warning" },
  POOR: { label: "Poor", tone: "warning" },
  DAMAGED: { label: "Damaged", tone: "danger" },
};

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "info" },
  RETURN_PENDING: { label: "Return Pending", tone: "warning" },
  RETURNED: { label: "Returned", tone: "success" },
  DAMAGED: { label: "Damaged", tone: "danger" },
  MISSING: { label: "Missing", tone: "danger" },
};

export const EMPLOYMENT_STATUS: Record<EmploymentStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  ON_LEAVE: { label: "On leave", tone: "warning" },
  ENDING: { label: "Ending", tone: "warning" },
  EXITED: { label: "Exited", tone: "muted" },
};

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INVITED: { label: "Invited", tone: "info" },
  SUSPENDED: { label: "Suspended", tone: "warning" },
  OFFBOARDED: { label: "Offboarded", tone: "muted" },
};

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "muted" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
  IN_TRANSIT: { label: "In Transit", tone: "purple" },
  RECEIVED: { label: "Received", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export const MAINTENANCE_STATUS: Record<MaintenanceStatus, { label: string; tone: Tone }> = {
  REPORTED: { label: "Reported", tone: "warning" },
  DIAGNOSED: { label: "Diagnosed", tone: "info" },
  IN_REPAIR: { label: "In Repair", tone: "purple" },
  AWAITING_PARTS: { label: "Awaiting Parts", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  RETURNED_TO_SERVICE: { label: "Returned to Service", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export const LOCATION_TYPE: Record<LocationType, string> = {
  WAREHOUSE: "Warehouse",
  STORAGE_ROOM: "Storage Room",
  RACK: "Rack",
  CABINET: "Cabinet",
  BIN: "Bin",
  PANTRY: "Pantry",
  IT_ROOM: "IT Room",
  MAILROOM: "Mail Room",
  FLOOR_GENERAL: "Floor Area",
  OTHER: "Other",
};

export const CATEGORY_GROUP: Record<CategoryGroup, string> = {
  IT_EQUIPMENT: "IT Equipment",
  OFFICE_EQUIPMENT: "Office Equipment",
  OFFICE_SUPPLIES: "Office Supplies",
  FACILITIES_SAFETY: "Facilities / Safety",
  CUSTOM: "Custom",
};

export const TRACKING_MODE: Record<TrackingMode, string> = {
  ASSET: "Tracked asset (serialized)",
  CONSUMABLE: "Consumable (quantity)",
  BOTH: "Both",
};

export const STOCK_TX_LABELS: Record<StockTxType, string> = {
  RECEIVE: "Receipt",
  ISSUE: "Issue",
  CONSUME: "Consumption",
  ADJUSTMENT: "Adjustment",
  REPLENISHMENT: "Replenishment",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  WRITE_OFF: "Write-off",
  RESERVE: "Reserve",
  RELEASE: "Release",
};

export const INVENTORY_TX_LABELS: Record<InventoryTxType, string> = {
  RECEIVE: "Receive",
  ISSUE: "Issue",
  ASSIGN: "Assign",
  RETURN: "Return",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
  REPAIR: "Repair",
  MAINTENANCE: "Maintenance",
  DISPOSAL: "Disposal",
  WRITE_OFF: "Write-off",
  CONSUMPTION: "Stock consumption",
  REPLENISHMENT: "Stock replenishment",
  RESERVED: "Reserved",
  RELEASED: "Released",
};

export const UNITS: Option[] = [
  { value: "EACH", label: "Each" },
  { value: "BOX", label: "Box" },
  { value: "PACK", label: "Pack" },
  { value: "REAM", label: "Ream" },
  { value: "CASE", label: "Case" },
  { value: "SET", label: "Set" },
  { value: "ROLL", label: "Roll" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "KG", label: "Kilogram" },
  { value: "LITER", label: "Liter" },
  { value: "METER", label: "Meter" },
];

export const DEPRECIATION_METHODS: Option[] = [
  { value: "NONE", label: "No depreciation" },
  { value: "STRAIGHT_LINE", label: "Straight line" },
  { value: "DECLINING_BALANCE", label: "Declining balance" },
];

export const DISPOSAL_METHODS: Option[] = [
  { value: "SALE", label: "Sale" },
  { value: "RECYCLE", label: "Recycle" },
  { value: "DONATION", label: "Donation" },
  { value: "SCRAPPED", label: "Scrapped" },
  { value: "RETURNED_TO_VENDOR", label: "Returned to vendor" },
  { value: "OTHER", label: "Other" },
];
