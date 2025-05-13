const Dashboard = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
  
    return (
      <div className="dashboard">
        <h1>Tableau de bord</h1>
        <div className="user-info">
          <h2>Bienvenue {user.first_name} {user.last_name}</h2>
          <p>Email: {user.email}</p>
          <p>Rôle: {user.role}</p>
          <p>Entreprise ID: {user.company_id}</p>
          {/* Debug info pour vérifier les données */}
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h3>Debug Info:</h3>
            <p>User ID: {user.user_id}</p>
            <p>First Connection: {user.firstConnection ? 'true' : 'false'}</p>
            <pre style={{ fontSize: '12px' }}>{JSON.stringify(user, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  };
  
  export default Dashboard;