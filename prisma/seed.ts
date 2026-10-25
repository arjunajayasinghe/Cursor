import { PrismaClient, CompanyRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.areaScope.deleteMany();
  await prisma.processAssignment.deleteMany();
  await prisma.processNode.deleteMany();
  await prisma.valueStream.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const aetriaOp = await prisma.user.create({
    data: {
      email: "operator@aetria.com",
      name: "Aetria Operator",
      passwordHash,
      isAetriaOperator: true,
    },
  });

  const acmeAdmin = await prisma.user.create({
    data: {
      email: "admin@acme.com",
      name: "Acme Admin",
      passwordHash,
      isAetriaOperator: false,
    },
  });

  const acmeEditor = await prisma.user.create({
    data: {
      email: "editor@acme.com",
      name: "Acme Area Editor",
      passwordHash,
      isAetriaOperator: false,
    },
  });

  const acmeViewer = await prisma.user.create({
    data: {
      email: "viewer@acme.com",
      name: "Acme Viewer",
      passwordHash,
      isAetriaOperator: false,
    },
  });

  const betaAdmin = await prisma.user.create({
    data: {
      email: "admin@beta.com",
      name: "Beta Admin",
      passwordHash,
      isAetriaOperator: false,
    },
  });

  const acme = await prisma.company.create({
    data: { name: "Acme Corp", slug: "acme" },
  });
  const beta = await prisma.company.create({
    data: { name: "Beta Industries", slug: "beta" },
  });

  await prisma.membership.createMany({
    data: [
      { userId: acmeAdmin.id, companyId: acme.id, role: CompanyRole.ADMIN },
      { userId: acmeEditor.id, companyId: acme.id, role: CompanyRole.AREA_EDITOR },
      { userId: acmeViewer.id, companyId: acme.id, role: CompanyRole.VIEWER },
      { userId: betaAdmin.id, companyId: beta.id, role: CompanyRole.ADMIN },
    ],
  });

  const vsOrder = [
    { code: "OTC", name: "Order to Cash", sortOrder: 1 },
    { code: "PTP", name: "Procure to Pay", sortOrder: 2 },
    { code: "RTR", name: "Record to Report", sortOrder: 3 },
    { code: "HTR", name: "Hire to Retire", sortOrder: 4 },
  ];

  const masterVs: Record<string, string> = {};
  for (const vs of vsOrder) {
    const created = await prisma.valueStream.create({
      data: { companyId: null, ...vs },
    });
    masterVs[vs.code] = created.id;
  }

  // Sample APQC-style master tree
  type NodeDef = {
    code: string;
    name: string;
    description?: string;
    vs?: string;
    children?: NodeDef[];
  };

  const masterTree: NodeDef[] = [
    {
      code: "1.0",
      name: "Develop Vision and Strategy",
      description: "Strategic planning and governance",
      children: [
        {
          code: "1.1",
          name: "Define the business concept and long-term vision",
          children: [
            { code: "1.1.1", name: "Assess the external environment" },
            { code: "1.1.2", name: "Survey the market and determine customer needs" },
          ],
        },
        {
          code: "1.2",
          name: "Develop business strategy",
          children: [
            { code: "1.2.1", name: "Develop overall mission statement" },
            { code: "1.2.2", name: "Evaluate strategic options" },
          ],
        },
      ],
    },
    {
      code: "2.0",
      name: "Develop and Manage Products and Services",
      vs: "OTC",
      children: [
        {
          code: "2.1",
          name: "Govern and manage product/service development",
          vs: "OTC",
          children: [
            { code: "2.1.1", name: "Evaluate performance of products", vs: "OTC" },
            { code: "2.1.2", name: "Generate new product ideas", vs: "OTC" },
          ],
        },
        {
          code: "2.2",
          name: "Generate and define new product/service ideas",
          vs: "OTC",
        },
      ],
    },
    {
      code: "3.0",
      name: "Market and Sell Products and Services",
      vs: "OTC",
      children: [
        {
          code: "3.1",
          name: "Understand markets, customers, and capabilities",
          vs: "OTC",
          children: [
            { code: "3.1.1", name: "Perform customer and market research", vs: "OTC" },
            { code: "3.1.2", name: "Evaluate customer experience", vs: "OTC" },
          ],
        },
        {
          code: "3.2",
          name: "Develop marketing strategy",
          vs: "OTC",
        },
        {
          code: "3.3",
          name: "Develop sales strategy",
          vs: "OTC",
          children: [
            { code: "3.3.1", name: "Develop sales forecasts", vs: "OTC" },
            { code: "3.3.2", name: "Establish sales partner/alliance relationships", vs: "OTC" },
          ],
        },
      ],
    },
    {
      code: "4.0",
      name: "Deliver Products and Services",
      vs: "PTP",
      children: [
        {
          code: "4.1",
          name: "Plan for and acquire necessary resources",
          vs: "PTP",
          children: [
            { code: "4.1.1", name: "Manage product inventory", vs: "PTP" },
            { code: "4.1.2", name: "Procure materials and services", vs: "PTP" },
          ],
        },
        {
          code: "4.2",
          name: "Produce/manufacture/deliver product",
          vs: "PTP",
        },
      ],
    },
    {
      code: "5.0",
      name: "Manage Customer Service",
      vs: "OTC",
      children: [
        {
          code: "5.1",
          name: "Develop customer care/service strategy",
          vs: "OTC",
        },
        {
          code: "5.2",
          name: "Plan and manage customer service operations",
          vs: "OTC",
        },
      ],
    },
    {
      code: "6.0",
      name: "Develop and Manage Human Capital",
      vs: "HTR",
      children: [
        {
          code: "6.1",
          name: "Develop and manage HR planning and policies",
          vs: "HTR",
          children: [
            { code: "6.1.1", name: "Develop HR strategy", vs: "HTR" },
            { code: "6.1.2", name: "Develop and implement HR programs", vs: "HTR" },
          ],
        },
        {
          code: "6.2",
          name: "Recruit, source, and select employees",
          vs: "HTR",
        },
      ],
    },
    {
      code: "8.0",
      name: "Manage Financial Resources",
      vs: "RTR",
      children: [
        {
          code: "8.1",
          name: "Perform planning and management accounting",
          vs: "RTR",
          children: [
            { code: "8.1.1", name: "Perform budgeting/forecasting", vs: "RTR" },
            { code: "8.1.2", name: "Perform cost accounting", vs: "RTR" },
          ],
        },
        {
          code: "8.2",
          name: "Process accounts payable and expense reimbursements",
          vs: "PTP",
        },
        {
          code: "8.3",
          name: "Process payroll",
          vs: "HTR",
        },
        {
          code: "8.4",
          name: "Process accounts receivable",
          vs: "OTC",
        },
      ],
    },
  ];

  async function insertTree(
    nodes: NodeDef[],
    parentId: string | null,
    level: number,
    companyId: string | null
  ) {
    let order = 0;
    for (const n of nodes) {
      const created = await prisma.processNode.create({
        data: {
          companyId,
          parentId,
          code: n.code,
          name: n.name,
          description: n.description ?? "",
          level,
          sortOrder: order++,
          valueStreamId: n.vs ? masterVs[n.vs] : null,
        },
      });
      if (n.children?.length) {
        await insertTree(n.children, created.id, level + 1, companyId);
      }
    }
  }

  await insertTree(masterTree, null, 1, null);

  // Assign OTC-related branches (2.0, 3.0, 5.0) + finance AR (8.4) to Acme
  const { assignMasterBranchToCompany } = await import("../src/lib/process-tree");

  // Copy value streams to Acme
  for (const vs of vsOrder) {
    await prisma.valueStream.create({
      data: {
        companyId: acme.id,
        code: vs.code,
        name: vs.name,
        sortOrder: vs.sortOrder,
      },
    });
  }

  const assignCodes = ["2.0", "3.0", "5.0", "8.4"];
  for (const code of assignCodes) {
    const node = await prisma.processNode.findFirst({
      where: { companyId: null, code },
    });
    if (node) {
      await assignMasterBranchToCompany({
        companyId: acme.id,
        masterNodeId: node.id,
        assignedById: aetriaOp.id,
      });
    }
  }

  // Assign PTP branch to Beta
  for (const vs of vsOrder.slice(0, 2)) {
    await prisma.valueStream.create({
      data: {
        companyId: beta.id,
        code: vs.code,
        name: vs.name,
        sortOrder: vs.sortOrder,
      },
    });
  }
  const ptp = await prisma.processNode.findFirst({
    where: { companyId: null, code: "4.0" },
  });
  if (ptp) {
    await assignMasterBranchToCompany({
      companyId: beta.id,
      masterNodeId: ptp.id,
      assignedById: aetriaOp.id,
    });
  }

  // Area editor scope: only "3.3 Develop sales strategy" branch at Acme
  const acmeSales = await prisma.processNode.findFirst({
    where: { companyId: acme.id, code: "3.3" },
  });
  const editorMembership = await prisma.membership.findFirst({
    where: { userId: acmeEditor.id, companyId: acme.id },
  });
  if (acmeSales && editorMembership) {
    await prisma.areaScope.create({
      data: {
        membershipId: editorMembership.id,
        processNodeId: acmeSales.id,
      },
    });
  }

  console.log("Seed complete.\n");
  console.log("Logins (password for all: password123):");
  console.log("  operator@aetria.com  — Aetria operator (master + company switch)");
  console.log("  admin@acme.com       — Acme company admin");
  console.log("  editor@acme.com      — Acme area editor (branch 3.3 only)");
  console.log("  viewer@acme.com      — Acme viewer");
  console.log("  admin@beta.com       — Beta company admin");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
