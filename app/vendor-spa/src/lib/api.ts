/**
 * API Client for Vendor Portal
 */

import axios, { AxiosInstance } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:4000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_ENDPOINT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add JWT token
    this.client.interceptors.request.use(async (config) => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to get auth token:', error);
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login on unauthorized
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async getFacilities() {
    const response = await this.client.get('/api/facilities');
    return response.data;
  }

  async getFacilityById(id: number) {
    const response = await this.client.get(`/api/facilities/${id}`);
    return response.data;
  }

  async getMaintenanceHistory(id: number) {
    const response = await this.client.get(`/api/facilities/${id}/maintenance-history`);
    return response.data;
  }

  async createMaintenanceReport(data: {
    equipment_id: number;
    report_date: string;
    description: string;
    next_maintenance_date?: string;
  }) {
    const response = await this.client.post('/api/maintenance-reports', data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
