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
        </div>
      </div>
    );
  };
  
  export default Dashboard;