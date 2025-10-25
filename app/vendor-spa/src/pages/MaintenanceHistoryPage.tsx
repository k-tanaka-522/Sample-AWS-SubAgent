/**
 * Maintenance History Page
 * 保守履歴画面 (Placeholder)
 */

import { useParams } from 'react-router-dom';

function MaintenanceHistoryPage() {
  const { id } = useParams();

  return (
    <div style={{ padding: '20px' }}>
      <h1>保守履歴</h1>
      <p>設備ID: {id} の保守履歴を表示します（実装中）</p>
    </div>
  );
}

export default MaintenanceHistoryPage;
