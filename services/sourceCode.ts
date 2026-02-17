
export const PROJECT_FILES = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parrish Health DME Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-slate-50 text-slate-900">
    <div id="root"></div>
</body>
</html>`
  },
  {
    path: 'types.ts',
    content: `export type UserRole = 'admin' | 'nurse' | 'homemaker' | 'office_staff';
export type RequestType = 'dme' | 'medication' | 'clinical' | 'communication';
export type RequestStatus = 'pending' | 'approved' | 'denied';

export interface Staff {
  uid: string;
  email: string;
  pin: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface DMEEquipment {
  id: string;
  itemName: string;
  sku: string;
  category: string;
}

export interface Request {
  id: string;
  type: RequestType;
  submitterId: string;
  patientName: string;
  details: any;
  status: RequestStatus;
  createdAt: number;
}`
  },
  {
    path: 'services/mockData.ts',
    content: `// Contains full MOCK_STAFF (Pin 1234) and categorized MOCK_DME list (Respiratory, Mobility, Beds, etc)`
  },
  {
    path: 'App.tsx',
    content: `// Main entry point with React Router, Dashboard, DME Form, and Admin Inbox.`
  }
];

export const generateAIPrompt = () => {
  let prompt = "# Parrish Health DME Portal - Project Source\n\n";
  prompt += "This is a React/TypeScript prototype for a medical supply portal. It uses Tailwind CSS for styling and LocalStorage for persistence. PIN is 1234.\n\n";
  
  PROJECT_FILES.forEach(file => {
    prompt += `--- START OF FILE ${file.path} ---\n\n`;
    prompt += file.content;
    prompt += `\n\n--- END OF FILE ${file.path} ---\n\n`;
  });

  return prompt;
};
