import fs from "fs";

async function upload() {
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "testapplicant@example.com", password: "testpass123" })
  });
  const { data: { access_token: appToken } } = await loginRes.json();

  const fileBlob = new Blob([fs.readFileSync("test_resume_real.pdf")], { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", fileBlob, "john_doe_resume.pdf");

  const uploadRes = await fetch("http://localhost:3000/api/applicants/profile/resume", {
    method: "POST",
    headers: { Authorization: `Bearer ${appToken}` },
    body: formData
  });

  const uploadData = await uploadRes.json();
  console.log("Upload Result:", uploadData);
  
  if (uploadData.success) {
    const taLoginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ta.staff@example.com", password: "tapassword123" })
    });
    const { data: { access_token: taToken } } = await taLoginRes.json();
    
    const analyzeRes = await fetch("http://localhost:3000/api/ta/applications/1/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${taToken}` }
    });
    const analyzeData = await analyzeRes.json();
    console.log("Analyze Result:", analyzeData);
  }
}
upload();
