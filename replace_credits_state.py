import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """  const [allVenues, setAllVenues] = useState<Venue[]>([]);"""

replacement = """  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [dashboardCredits, setDashboardCredits] = useState<any>(null);"""

code = code.replace(target, replacement)

target2 = """  // Sync auth state reactively
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
    });
    return unsubscribe;
  }, []);"""

replacement2 = """  // Sync auth state reactively
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        if (user) {
            getOrganiserCredits(user.uid).then(data => {
                if (data) setDashboardCredits(data);
            });
        }
    });
    return unsubscribe;
  }, []);"""

code = code.replace(target2, replacement2)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
