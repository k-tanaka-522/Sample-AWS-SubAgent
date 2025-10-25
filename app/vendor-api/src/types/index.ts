/**
 * Type definitions for Vendor API
 */

// Database Models
export interface Equipment {
  equipment_id: number;
  equipment_name: string;
  model_number: string | null;
  category: string | null;
  quantity: number;
  storage_location: string | null;
  purchase_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Company {
  company_id: number;
  company_name: string;
  contact_email: string;
  contact_phone: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  order_id: number;
  user_id: number;
  company_id: number;
  status: OrderStatus;
  order_date: Date;
  delivery_date: Date | null;
  total_amount: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  order_item_id: number;
  order_id: number;
  equipment_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: Date;
}

export interface MaintenanceReport {
  report_id: number;
  equipment_id: number;
  company_id: number;
  report_date: Date;
  description: string;
  next_maintenance_date: Date | null;
  created_at: Date;
}

// Enums
export type OrderStatus = 'pending' | 'approved' | 'sent' | 'delivered';

// DTOs (Data Transfer Objects)
export interface CreateMaintenanceReportDto {
  equipment_id: number;
  report_date: string; // ISO 8601
  description: string;
  next_maintenance_date?: string; // ISO 8601
}

export interface UpdateDeliveryDateDto {
  delivery_date: string; // ISO 8601
}

// API Response Types
export interface FacilityWithOrders extends Equipment {
  latest_order?: Order;
}

export interface MaintenanceHistoryResponse {
  equipment: Equipment;
  reports: MaintenanceReport[];
}

// JWT Payload
export interface CognitoJwtPayload {
  sub: string; // User ID
  email: string;
  'cognito:username': string;
  'custom:company_id': string; // Company ID (事業者の識別)
  exp: number;
  iat: number;
}

// Express Request with Auth
export interface AuthenticatedRequest extends Express.Request {
  user?: CognitoJwtPayload;
}
