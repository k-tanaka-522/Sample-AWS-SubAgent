/**
 * Facility List Page
 * 担当設備一覧
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';

function FacilityListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => apiClient.getFacilities(),
  });

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  if (error) {
    return <div>エラーが発生しました: {(error as Error).message}</div>;
  }

  const facilities = data?.data || [];

  return (
    <div style={{ padding: '20px' }}>
      <h1>担当設備一覧</h1>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '20px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>ID</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>設備名</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>型番</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>カテゴリ</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>保管場所</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {facilities.map((facility: any) => (
            <tr key={facility.equipment_id}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {facility.equipment_id}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {facility.equipment_name}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {facility.model_number || '-'}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {facility.category || '-'}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                {facility.storage_location || '-'}
              </td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                <Link to={`/facilities/${facility.equipment_id}/history`}>保守履歴</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '20px' }}>
        <Link to="/report">
          <button style={{ padding: '10px 20px', fontSize: '16px' }}>保守報告を登録</button>
        </Link>
      </div>
    </div>
  );
}

export default FacilityListPage;
