import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Farm,
  FarmListResponse,
  CreateFarmRequest,
  UpdateFarmRequest,
} from '@shared/api.interface';

interface ListFarmsParams {
  page?: number;
  pageSize?: number;
}

export const farmApi = {
  async listFarms(params?: ListFarmsParams): Promise<FarmListResponse> {
    const { data } = await axiosForBackend.get<FarmListResponse>('/api/farms', {
      params,
    });
    return data;
  },

  async getFarm(id: string): Promise<Farm> {
    const { data } = await axiosForBackend.get<Farm>(`/api/farms/${id}`);
    return data;
  },

  async createFarm(data: CreateFarmRequest): Promise<Farm> {
    const { data: result } = await axiosForBackend.post<Farm>(
      '/api/farms',
      data,
    );
    return result;
  },

  async updateFarm(id: string, data: UpdateFarmRequest): Promise<Farm> {
    const { data: result } = await axiosForBackend.patch<Farm>(
      `/api/farms/${id}`,
      data,
    );
    return result;
  },

  async deleteFarm(id: string): Promise<{ id: string }> {
    await axiosForBackend.delete(`/api/farms/${id}`);
    return { id };
  },
};
