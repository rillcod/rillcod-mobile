import { COLORS } from './colors';

export interface ProtocolModule {
  id: string;
  title: string;
  description: string;
  language: 'javascript' | 'python' | 'html' | 'robotics';
  outcome: string;
  starterCode: string;
}

export interface ProtocolPhase {
  id: number;
  name: string;
  icon: string;
  color: string;
  modules: ProtocolModule[];
}

export const PROTOCOL_PHASES: ProtocolPhase[] = [
  {
    id: 1,
    name: 'Code Foundations',
    icon: 'CD',
    color: COLORS.primary,
    modules: [
      {
        id: 'p1-js-vars',
        title: 'Variables and output',
        description: 'Store values, print them, and understand the shape of simple code.',
        language: 'javascript',
        outcome: 'You should be able to declare values and explain what each line is doing.',
        starterCode: "const studentName = 'Ada';\nconst age = 13;\nconsole.log(`My name is ${studentName} and I am ${age}`);",
      },
      {
        id: 'p1-js-flow',
        title: 'Conditionals and loops',
        description: 'Control logic with if statements and repeated actions with loops.',
        language: 'javascript',
        outcome: 'You should be able to branch logic and repeat a task safely.',
        starterCode: "for (let i = 1; i <= 5; i++) {\n  if (i % 2 === 0) {\n    console.log('Even', i);\n  }\n}",
      },
      {
        id: 'p1-python-func',
        title: 'Python functions',
        description: 'Write reusable functions with parameters and return values.',
        language: 'python',
        outcome: 'You should be able to package logic into a named reusable block.',
        starterCode: "def calculate_area(width, height):\n    return width * height\n\nprint(calculate_area(5, 3))",
      },
    ],
  },
  {
    id: 2,
    name: 'Web Engine',
    icon: 'WB',
    color: COLORS.success,
    modules: [
      {
        id: 'p2-html-structure',
        title: 'HTML structure',
        description: 'Build semantic layout with headings, sections, lists, and buttons.',
        language: 'html',
        outcome: 'You should be able to create a clear page skeleton that a user can navigate.',
        starterCode: "<main>\n  <h1>STEM Dashboard</h1>\n  <section>\n    <p>Welcome to the lab.</p>\n    <button>Launch</button>\n  </section>\n</main>",
      },
      {
        id: 'p2-html-dom',
        title: 'DOM interactions',
        description: 'Connect buttons and page elements to user actions.',
        language: 'html',
        outcome: 'You should be able to update page content after a click.',
        starterCode: "<button onclick=\"launchMission()\">Launch</button>\n<p id=\"status\">Idle</p>\n<script>\nfunction launchMission() {\n  document.getElementById('status').textContent = 'Mission started';\n}\n</script>",
      },
      {
        id: 'p2-js-arrays',
        title: 'Arrays and mapping',
        description: 'Transform lists of values into useful UI or summaries.',
        language: 'javascript',
        outcome: 'You should be able to filter, map, and summarize a collection.',
        starterCode: "const scores = [45, 70, 88, 91];\nconst passing = scores.filter((score) => score >= 50);\nconst boosted = passing.map((score) => score + 5);\nconsole.log(boosted);",
      },
    ],
  },
  {
    id: 3,
    name: 'Applied Systems',
    icon: 'AI',
    color: COLORS.warning,
    modules: [
      {
        id: 'p3-python-data',
        title: 'Data and APIs',
        description: 'Work with dictionaries, arrays, and remote data responses.',
        language: 'python',
        outcome: 'You should be able to inspect structured data and extract key values.',
        starterCode: "student = {'name': 'Musa', 'score': 82}\nprint(student['name'])\nprint(student['score'])",
      },
      {
        id: 'p3-js-async',
        title: 'Async workflows',
        description: 'Handle loading, success, and error paths when calling remote services.',
        language: 'javascript',
        outcome: 'You should be able to explain the difference between waiting and failing gracefully.',
        starterCode: "async function loadData() {\n  try {\n    const response = await fetch('https://example.com/data');\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.log('Request failed');\n  }\n}",
      },
      {
        id: 'p3-robotics-signals',
        title: 'Sensors and signals',
        description: 'Read simple robot inputs and react with output behavior.',
        language: 'robotics',
        outcome: 'You should be able to describe an input-process-output loop for a robot.',
        starterCode: "Read ultrasonic distance\nIf distance < 10cm\n  Stop motors\nElse\n  Keep moving",
      },
    ],
  },
  {
    id: 4,
    name: 'Launch Track',
    icon: 'LX',
    color: COLORS.accent,
    modules: [
      {
        id: 'p4-ui-systems',
        title: 'UI composition',
        description: 'Combine cards, actions, and status into a coherent interface.',
        language: 'html',
        outcome: 'You should be able to assemble a working layout with meaningful states.',
        starterCode: "<section class=\"card\">\n  <h2>Mission Control</h2>\n  <p>3 tasks pending review</p>\n</section>",
      },
      {
        id: 'p4-project-logic',
        title: 'Project logic review',
        description: 'Connect features, data flow, and completion criteria across screens.',
        language: 'javascript',
        outcome: 'You should be able to break a feature into logic, UI, and data dependencies.',
        starterCode: "const feature = {\n  screen: 'Reports',\n  data: ['students', 'grades'],\n  action: 'publish',\n};",
      },
      {
        id: 'p4-capstone',
        title: 'Capstone readiness',
        description: 'Prepare for a final build by reviewing the whole sequence.',
        language: 'robotics',
        outcome: 'You should know what to build next and which module to revisit if stuck.',
        starterCode: "Capstone checklist:\n1. Inputs confirmed\n2. Logic reviewed\n3. Output tested\n4. Report prepared",
      },
    ],
  },
];

export const PROTOCOL_LANGUAGE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
  { key: 'html', label: 'Web' },
  { key: 'robotics', label: 'Robotics' },
] as const;
