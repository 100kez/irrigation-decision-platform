import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AiDiagnosticChatRequest,
  AiDiagnosticChatResponse,
} from '@shared/api.interface';

export const aiDiagnosticApi = {
  async chat(
    data: AiDiagnosticChatRequest,
  ): Promise<AiDiagnosticChatResponse> {
    const { data: result } =
      await axiosForBackend.post<AiDiagnosticChatResponse>(
        '/api/ai-diagnostic/chat',
        data,
      );
    return result;
  },
};
