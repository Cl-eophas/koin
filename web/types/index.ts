export type Role = "staff" | "supervisor" | "general_supervisor" | "admin";

export interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  staffId: string;
  role: Role;
  roleLabel?: string;
  branch_id?: string;
  branchName?: string;
  avatarInitials?: string;
  status?: "pending" | "approved" | "rejected";
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}
