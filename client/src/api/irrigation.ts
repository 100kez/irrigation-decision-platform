import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  CreateDecisionWithAiRequest,
  CreateExecutionRequest,
  DashboardResponse,
  DecisionListResponse,
  IrrigationDecisionRecord,
  ListDecisionsQuery,
  UpdateDecisionStatusRequest,
  UpdatePlanRequest,
} from '@shared/api.interface';

export const irrigationApi = {
  async createDecision(
    data: CreateDecisionWithAiRequest,
  ): Promise<IrrigationDecisionRecord> {
    const { data: result } = await axiosForBackend.post<IrrigationDecisionRecord>(
      '/api/irrigation/decide',
      data,
    );
    return result;
  },

  async getDecision(id: string): Promise<IrrigationDecisionRecord> {
    const { data } = await axiosForBackend.get<IrrigationDecisionRecord>(
      `/api/irrigation/decisions/${id}`,
    );
    return data;
  },

  async listDecisions(
    params?: ListDecisionsQuery,
  ): Promise<DecisionListResponse> {
    const { data } = await axiosForBackend.get<DecisionListResponse>(
      '/api/irrigation/decisions',
      { params },
    );
    return data;
  },

  async deleteDecision(id: string): Promise<{ id: string }> {
    await axiosForBackend.delete(`/api/irrigation/decisions/${id}`);
    return { id };
  },

  async getDashboard(range: 'all' | '7d' | '30d'): Promise<DashboardResponse> {
    const { data } = await axiosForBackend.get<DashboardResponse>(
      '/api/irrigation/dashboard',
      { params: { range } },
    );
    return data;
  },

  async updateDecisionStatus(
    id: string,
    data: UpdateDecisionStatusRequest,
  ): Promise<IrrigationDecisionRecord> {
    const { data: result } = await axiosForBackend.patch<IrrigationDecisionRecord>(
      `/api/irrigation/decisions/${id}/status`,
      data,
    );
    return result;
  },

  async addExecution(
    id: string,
    data: CreateExecutionRequest,
  ): Promise<IrrigationDecisionRecord> {
    const { data: result } = await axiosForBackend.post<IrrigationDecisionRecord>(
      `/api/irrigation/decisions/${id}/execution`,
      data,
    );
    return result;
  },

  async updatePlan(
    id: string,
    data: UpdatePlanRequest,
  ): Promise<IrrigationDecisionRecord> {
    const { data: result } = await axiosForBackend.put<IrrigationDecisionRecord>(
      `/api/irrigation/decisions/${id}/plan`,
      data,
    );
    return result;
  },
};
