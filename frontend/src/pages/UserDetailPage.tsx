import { useParams } from 'react-router-dom';

export function UserDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">User Detail</h1>
      <p className="text-admin-muted mt-1">ID: {id}</p>
      <p className="text-admin-muted mt-4">Connect to the API to load user details.</p>
    </div>
  );
}
