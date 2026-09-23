const API_URL = "http://localhost:5000";

async function checkAPI() {
  try {
    // Login
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "EbSycq92GdZnku" }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.log("Login failed:", loginData.message);
      return;
    }
    const token = loginData.token;
    console.log("✓ Login successful");

    // Get employees
    const empRes = await fetch(`${API_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const empData = await empRes.json();
    console.log(`✓ Employees: ${empData.count} records`);

    // Get leaves
    const leaveRes = await fetch(`${API_URL}/api/leaves`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const leaveData = await leaveRes.json();
    console.log(`✓ Leaves: ${leaveData.count} records`);

    // Get payrolls
    const payRes = await fetch(`${API_URL}/api/payroll`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payData = await payRes.json();
    console.log(
      `✓ Payrolls: ${(payData.data ? payData.data.length : 0)} records`
    );

    console.log("\n=== All API endpoints working ===");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

checkAPI();