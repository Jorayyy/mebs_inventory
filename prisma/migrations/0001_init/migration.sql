-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'ENDING', 'EXITED');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'STORAGE_ROOM', 'RACK', 'CABINET', 'BIN', 'PANTRY', 'IT_ROOM', 'MAILROOM', 'FLOOR_GENERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('ASSET', 'CONSUMABLE', 'BOTH');

-- CreateEnum
CREATE TYPE "CategoryGroup" AS ENUM ('IT_EQUIPMENT', 'OFFICE_EQUIPMENT', 'OFFICE_SUPPLIES', 'FACILITIES_SAFETY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_STORAGE', 'UNDER_MAINTENANCE', 'DAMAGED', 'LOST', 'STOLEN', 'FOR_REPAIR', 'RETIRED', 'DISPOSED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'RETURN_PENDING', 'RETURNED', 'DAMAGED', 'MISSING');

-- CreateEnum
CREATE TYPE "InventoryTxType" AS ENUM ('RECEIVE', 'ISSUE', 'ASSIGN', 'RETURN', 'TRANSFER', 'ADJUSTMENT', 'REPAIR', 'MAINTENANCE', 'DISPOSAL', 'WRITE_OFF', 'CONSUMPTION', 'REPLENISHMENT', 'RESERVED', 'RELEASED');

-- CreateEnum
CREATE TYPE "StockTxType" AS ENUM ('RECEIVE', 'ISSUE', 'CONSUME', 'ADJUSTMENT', 'REPLENISHMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'WRITE_OFF', 'RESERVE', 'RELEASE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferItemStatus" AS ENUM ('PENDING', 'SENT', 'RECEIVED', 'DAMAGED', 'MISSING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferLineType" AS ENUM ('ASSET', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('REPORTED', 'DIAGNOSED', 'IN_REPAIR', 'AWAITING_PARTS', 'COMPLETED', 'RETURNED_TO_SERVICE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivingKind" AS ENUM ('ASSET', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "DisposalMethod" AS ENUM ('SALE', 'RECYCLE', 'DONATION', 'SCRAPPED', 'RETURNED_TO_VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'PENDING_APPROVAL', 'TRANSFER_UPDATE', 'ASSIGNMENT_RETURN_DUE', 'ASSIGNMENT_RETURNED', 'WARRANTY_EXPIRING', 'MAINTENANCE_UPDATE', 'ASSET_DAMAGED', 'ASSET_LOST', 'RECEIVING_COMPLETED', 'GENERAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'USER_CREATED', 'USER_UPDATED', 'USER_STATUS_CHANGED', 'ROLE_CHANGED', 'PERMISSION_CHANGED', 'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED', 'ASSET_STATUS_CHANGED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_RETURNED', 'ASSIGNMENT_ACKNOWLEDGED', 'STOCK_RECEIVED', 'STOCK_ISSUED', 'STOCK_CONSUMED', 'STOCK_ADJUSTED', 'TRANSFER_CREATED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED', 'TRANSFER_SHIPPED', 'TRANSFER_RECEIVED', 'TRANSFER_COMPLETED', 'MAINTENANCE_CREATED', 'MAINTENANCE_UPDATED', 'DISPOSAL_CREATED', 'SUPPLIER_CREATED', 'SUPPLIER_UPDATED', 'PURCHASE_ORDER_CREATED', 'ORG_UPDATED', 'CATEGORY_UPDATED', 'EXPORT_GENERATED', 'DELETION_ATTEMPTED', 'UNAUTHORIZED_ACCESS', 'SETTINGS_UPDATED', 'DIAGNOSTIC_VIEWED');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('NONE', 'STRAIGHT_LINE', 'DECLINING_BALANCE');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "user_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'STORAGE_ROOM',
    "buildingId" TEXT,
    "floorId" TEXT,
    "roomId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT,
    "costCenterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "userId" TEXT,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "teamId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "managerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group" "CategoryGroup" NOT NULL DEFAULT 'CUSTOM',
    "trackingMode" "TrackingMode" NOT NULL DEFAULT 'BOTH',
    "tagPrefix" TEXT,
    "parentId" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_types" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagPrefix" TEXT,
    "defaultWarrantyMonths" INTEGER,
    "defaultCondition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "attributes" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "productsSupplied" TEXT,
    "notes" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "requestedById" TEXT,
    "approvedById" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "categoryId" TEXT,
    "itemTypeId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivings" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT,
    "siteId" TEXT NOT NULL,
    "stockLocationId" TEXT,
    "departmentId" TEXT,
    "receivedById" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "referenceNumber" TEXT,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_items" (
    "id" TEXT NOT NULL,
    "receivingId" TEXT NOT NULL,
    "kind" "ReceivingKind" NOT NULL DEFAULT 'ASSET',
    "categoryId" TEXT,
    "itemTypeId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "serialNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inventoryItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "barcode" TEXT,
    "qrCode" TEXT,
    "serialNumber" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "itemTypeId" TEXT,
    "manufacturer" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "supplierId" TEXT,
    "receivingId" TEXT,
    "costCenterId" TEXT,
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "warrantyMonths" INTEGER,
    "siteId" TEXT NOT NULL,
    "buildingId" TEXT,
    "floorId" TEXT,
    "roomId" TEXT,
    "stockLocationId" TEXT,
    "departmentId" TEXT,
    "assignedEmployeeId" TEXT,
    "custodianUserId" TEXT,
    "createdById" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_STORAGE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'NONE',
    "salvageValue" DECIMAL(14,2),
    "usefulLifeMonths" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId" TEXT,
    "departmentId" TEXT,
    "conditionAtAssignment" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "expectedReturnAt" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnCondition" "AssetCondition",
    "returnNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_transactions" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "InventoryTxType" NOT NULL,
    "fromStatus" "AssetStatus",
    "toStatus" "AssetStatus",
    "fromSiteId" TEXT,
    "toSiteId" TEXT,
    "fromRoomId" TEXT,
    "toRoomId" TEXT,
    "fromEmployeeId" TEXT,
    "toEmployeeId" TEXT,
    "performedById" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "technicianId" TEXT,
    "vendorId" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'REPORTED',
    "diagnosis" TEXT,
    "repairAction" TEXT,
    "partsUsed" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "warrantyClaim" BOOLEAN NOT NULL DEFAULT false,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_records" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "method" "DisposalMethod" NOT NULL,
    "approvedById" TEXT,
    "disposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proceeds" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'document',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "itemTypeId" TEXT,
    "siteId" TEXT NOT NULL,
    "stockLocationId" TEXT NOT NULL,
    "binLocation" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'EACH',
    "currentQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "maxQty" DECIMAL(14,3),
    "reorderLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMovementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "StockTxType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "balanceAfter" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2),
    "fromSiteId" TEXT,
    "toSiteId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "performedById" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromSiteId" TEXT NOT NULL,
    "toSiteId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "expectedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "courier" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_assets" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "TransferItemStatus" NOT NULL DEFAULT 'PENDING',
    "conditionAtSend" "AssetCondition",
    "conditionAtReceive" "AssetCondition",
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "receivedQuantity" DECIMAL(14,3),
    "status" "TransferItemStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "siteId" TEXT,
    "description" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeNumber_key" ON "users"("employeeNumber");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sites_userId_siteId_key" ON "user_sites"("userId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_companyId_key_key" ON "system_settings"("companyId", "key");

-- CreateIndex
CREATE INDEX "sites_companyId_idx" ON "sites"("companyId");

-- CreateIndex
CREATE INDEX "sites_status_idx" ON "sites"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sites_companyId_code_key" ON "sites"("companyId", "code");

-- CreateIndex
CREATE INDEX "buildings_siteId_idx" ON "buildings"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_siteId_code_key" ON "buildings"("siteId", "code");

-- CreateIndex
CREATE INDEX "floors_buildingId_idx" ON "floors"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "floors_buildingId_code_key" ON "floors"("buildingId", "code");

-- CreateIndex
CREATE INDEX "rooms_floorId_idx" ON "rooms"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_floorId_code_key" ON "rooms"("floorId", "code");

-- CreateIndex
CREATE INDEX "stock_locations_siteId_idx" ON "stock_locations"("siteId");

-- CreateIndex
CREATE INDEX "stock_locations_type_idx" ON "stock_locations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_siteId_code_key" ON "stock_locations"("siteId", "code");

-- CreateIndex
CREATE INDEX "departments_siteId_idx" ON "departments"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_siteId_code_key" ON "departments"("siteId", "code");

-- CreateIndex
CREATE INDEX "teams_departmentId_idx" ON "teams"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_departmentId_code_key" ON "teams"("departmentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_companyId_code_key" ON "cost_centers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_siteId_idx" ON "employees"("siteId");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_employmentStatus_idx" ON "employees"("employmentStatus");

-- CreateIndex
CREATE INDEX "employees_lastName_idx" ON "employees"("lastName");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_employeeNo_key" ON "employees"("companyId", "employeeNo");

-- CreateIndex
CREATE INDEX "categories_companyId_idx" ON "categories"("companyId");

-- CreateIndex
CREATE INDEX "categories_group_idx" ON "categories"("group");

-- CreateIndex
CREATE UNIQUE INDEX "categories_companyId_slug_key" ON "categories"("companyId", "slug");

-- CreateIndex
CREATE INDEX "item_types_categoryId_idx" ON "item_types"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "item_types_categoryId_slug_key" ON "item_types"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "purchase_orders_siteId_idx" ON "purchase_orders"("siteId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_supplierId_poNumber_key" ON "purchase_orders"("supplierId", "poNumber");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "receivings_receiptNumber_key" ON "receivings"("receiptNumber");

-- CreateIndex
CREATE INDEX "receivings_siteId_idx" ON "receivings"("siteId");

-- CreateIndex
CREATE INDEX "receivings_supplierId_idx" ON "receivings"("supplierId");

-- CreateIndex
CREATE INDEX "receivings_deliveryDate_idx" ON "receivings"("deliveryDate");

-- CreateIndex
CREATE INDEX "receiving_items_receivingId_idx" ON "receiving_items"("receivingId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_barcode_key" ON "assets"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "assets_qrCode_key" ON "assets"("qrCode");

-- CreateIndex
CREATE INDEX "assets_siteId_idx" ON "assets"("siteId");

-- CreateIndex
CREATE INDEX "assets_categoryId_idx" ON "assets"("categoryId");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_condition_idx" ON "assets"("condition");

-- CreateIndex
CREATE INDEX "assets_assignedEmployeeId_idx" ON "assets"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "assets_departmentId_idx" ON "assets"("departmentId");

-- CreateIndex
CREATE INDEX "assets_warrantyEnd_idx" ON "assets"("warrantyEnd");

-- CreateIndex
CREATE INDEX "assets_createdAt_idx" ON "assets"("createdAt");

-- CreateIndex
CREATE INDEX "assets_name_idx" ON "assets"("name");

-- CreateIndex
CREATE INDEX "assets_model_idx" ON "assets"("model");

-- CreateIndex
CREATE UNIQUE INDEX "assets_companyId_assetTag_key" ON "assets"("companyId", "assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "assets_companyId_serialNumber_key" ON "assets"("companyId", "serialNumber");

-- CreateIndex
CREATE INDEX "asset_assignments_employeeId_status_idx" ON "asset_assignments"("employeeId", "status");

-- CreateIndex
CREATE INDEX "asset_assignments_assetId_idx" ON "asset_assignments"("assetId");

-- CreateIndex
CREATE INDEX "asset_assignments_status_idx" ON "asset_assignments"("status");

-- CreateIndex
CREATE INDEX "asset_assignments_expectedReturnAt_idx" ON "asset_assignments"("expectedReturnAt");

-- CreateIndex
CREATE INDEX "asset_transactions_assetId_createdAt_idx" ON "asset_transactions"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_transactions_type_idx" ON "asset_transactions"("type");

-- CreateIndex
CREATE INDEX "asset_transactions_performedById_idx" ON "asset_transactions"("performedById");

-- CreateIndex
CREATE INDEX "asset_transactions_createdAt_idx" ON "asset_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "asset_transactions_toSiteId_idx" ON "asset_transactions"("toSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_records_referenceNo_key" ON "maintenance_records"("referenceNo");

-- CreateIndex
CREATE INDEX "maintenance_records_assetId_idx" ON "maintenance_records"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_records_status_idx" ON "maintenance_records"("status");

-- CreateIndex
CREATE INDEX "maintenance_records_reportedAt_idx" ON "maintenance_records"("reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "disposal_records_assetId_key" ON "disposal_records"("assetId");

-- CreateIndex
CREATE INDEX "disposal_records_disposedAt_idx" ON "disposal_records"("disposedAt");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "inventory_items_siteId_idx" ON "inventory_items"("siteId");

-- CreateIndex
CREATE INDEX "inventory_items_stockLocationId_idx" ON "inventory_items"("stockLocationId");

-- CreateIndex
CREATE INDEX "inventory_items_categoryId_idx" ON "inventory_items"("categoryId");

-- CreateIndex
CREATE INDEX "inventory_items_name_idx" ON "inventory_items"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_companyId_sku_siteId_stockLocationId_key" ON "inventory_items"("companyId", "sku", "siteId", "stockLocationId");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventoryItemId_createdAt_idx" ON "inventory_transactions"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions"("type");

-- CreateIndex
CREATE INDEX "inventory_transactions_createdAt_idx" ON "inventory_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_performedById_idx" ON "inventory_transactions"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_transferNumber_key" ON "transfers"("transferNumber");

-- CreateIndex
CREATE INDEX "transfers_fromSiteId_idx" ON "transfers"("fromSiteId");

-- CreateIndex
CREATE INDEX "transfers_toSiteId_idx" ON "transfers"("toSiteId");

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE INDEX "transfers_requestedAt_idx" ON "transfers"("requestedAt");

-- CreateIndex
CREATE INDEX "transfer_assets_assetId_idx" ON "transfer_assets"("assetId");

-- CreateIndex
CREATE INDEX "transfer_assets_status_idx" ON "transfer_assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_assets_transferId_assetId_key" ON "transfer_assets"("transferId", "assetId");

-- CreateIndex
CREATE INDEX "transfer_items_inventoryItemId_idx" ON "transfer_items"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_items_transferId_inventoryItemId_key" ON "transfer_items"("transferId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_types" ADD CONSTRAINT "item_types_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "item_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_custodianUserId_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_records" ADD CONSTRAINT "disposal_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "item_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_assets" ADD CONSTRAINT "transfer_assets_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_assets" ADD CONSTRAINT "transfer_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

