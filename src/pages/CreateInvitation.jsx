import { useState } from 'react';
import { invitationAPI } from '../services/api';

const CreateInvitation = () => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await invitationAPI.create({
        email,
        firstName,
        lastName,
        companyId: user.company_id,
        adminId: user.user_id,
      });
      
      if (response.success) {
        setMessage('Invitation créée avec succès !');
        setEmail('');
        setFirstName('');
        setLastName('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création de l\'invitation');
    }
  };

  return (
    <div className="create-invitation-container">
      <form onSubmit={handleSubmit} className="create-invitation-form">
        <h2>Créer une invitation</h2>
        
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Prénom</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Nom</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        
        <button type="submit">Créer l'invitation</button>
      </form>
    </div>
  );
};

export default CreateInvitation;