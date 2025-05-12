import { useState, useEffect } from 'react';
import { invitationAPI } from '../services/api';

const AdminInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState('');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const response = await invitationAPI.list(user.user_id, user.company_id);
      if (response.success) {
        setInvitations(response.invitations);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la récupération des invitations');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Used': return 'status-used';
      case 'Expired': return 'status-expired';
      case 'Pending': return 'status-pending';
      default: return '';
    }
  };

  return (
    <div className="invitations-container">
      <h2>Gestion des invitations</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="invitations-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Date d'invitation</th>
              <th>Date d'expiration</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.invite_id}>
                <td>{invitation.email}</td>
                <td>{invitation.last_name}</td>
                <td>{invitation.first_name}</td>
                <td>{formatDate(invitation.invited_at)}</td>
                <td>{invitation.expires_at ? formatDate(invitation.expires_at) : 'N/A'}</td>
                <td>
                  <span className={`status ${getStatusClass(invitation.status)}`}>
                    {invitation.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminInvitations;