/** Independent per-module status machines — stages may overlap; no forced sequence. */

export type StatusMachine = {
  moduleKey: string;
  label: string;
  initial: string;
  statuses: string[];
  transitions: Record<string, string[]>;
};

export const STATUS_MACHINES: StatusMachine[] = [
  {
    moduleKey: "pr",
    label: "Purchase requisitions",
    initial: "Draft",
    statuses: ["Draft", "Pending release", "Released", "Closed", "Cancelled"],
    transitions: {
      Draft: ["Pending release", "Cancelled"],
      "Pending release": ["Released", "Draft", "Cancelled"],
      Released: ["Closed", "Cancelled"],
      Closed: [],
      Cancelled: ["Draft"],
    },
  },
  {
    moduleKey: "quotes",
    label: "Quotations",
    initial: "Requested",
    statuses: ["Requested", "Awaiting quote", "Received", "Shortlisted", "Rejected", "Closed"],
    transitions: {
      Requested: ["Awaiting quote", "Closed"],
      "Awaiting quote": ["Received", "Closed"],
      Received: ["Shortlisted", "Rejected", "Closed"],
      Shortlisted: ["Closed", "Rejected"],
      Rejected: ["Closed"],
      Closed: [],
    },
  },
  {
    moduleKey: "eval",
    label: "Evaluation",
    initial: "Draft",
    statuses: ["Draft", "In review", "Pending decision", "Approved", "Returned", "Closed"],
    transitions: {
      Draft: ["In review"],
      "In review": ["Pending decision", "Returned"],
      "Pending decision": ["Approved", "Returned"],
      Returned: ["In review", "Closed"],
      Approved: ["Closed"],
      Closed: [],
    },
  },
  {
    moduleKey: "po",
    label: "PO / PI",
    initial: "Draft",
    statuses: ["Draft", "Pending SAP release", "Released", "Confirmed", "Closed", "Cancelled"],
    transitions: {
      Draft: ["Pending SAP release", "Cancelled"],
      "Pending SAP release": ["Released", "Cancelled"],
      Released: ["Confirmed", "Closed", "Cancelled"],
      Confirmed: ["Closed"],
      Closed: [],
      Cancelled: [],
    },
  },
  {
    moduleKey: "pay",
    label: "Payments",
    initial: "Scheduled",
    statuses: ["Scheduled", "Submitted to bank", "Part paid", "Paid", "Overdue", "Cancelled"],
    transitions: {
      Scheduled: ["Submitted to bank", "Overdue", "Cancelled"],
      "Submitted to bank": ["Part paid", "Paid", "Overdue"],
      "Part paid": ["Paid", "Overdue"],
      Overdue: ["Submitted to bank", "Paid", "Cancelled"],
      Paid: [],
      Cancelled: [],
    },
  },
  {
    moduleKey: "confirm",
    label: "Supplier confirmation",
    initial: "Awaiting response",
    statuses: ["Awaiting response", "Acknowledged", "Confirmed", "Revised", "Closed"],
    transitions: {
      "Awaiting response": ["Acknowledged", "Confirmed"],
      Acknowledged: ["Confirmed", "Revised"],
      Confirmed: ["Revised", "Closed"],
      Revised: ["Confirmed", "Closed"],
      Closed: [],
    },
  },
  {
    moduleKey: "ship",
    label: "Shipping",
    initial: "Booking pending",
    statuses: ["Booking pending", "Booked", "Departed", "In transit", "Arrived", "Closed"],
    transitions: {
      "Booking pending": ["Booked"],
      Booked: ["Departed", "In transit"],
      Departed: ["In transit", "Arrived"],
      "In transit": ["Arrived"],
      Arrived: ["Closed"],
      Closed: [],
    },
  },
  {
    moduleKey: "vessel",
    label: "Vessel tracking",
    initial: "Awaiting departure",
    statuses: ["Awaiting departure", "In transit", "Delayed", "Arrived", "At berth"],
    transitions: {
      "Awaiting departure": ["In transit"],
      "In transit": ["Delayed", "Arrived", "At berth"],
      Delayed: ["In transit", "Arrived"],
      Arrived: ["At berth"],
      "At berth": [],
    },
  },
  {
    moduleKey: "customs",
    label: "Customs clearance",
    initial: "Awaiting documents",
    statuses: [
      "Awaiting documents",
      "Submitted",
      "Duty pending",
      "Inspection",
      "Released",
      "Closed",
    ],
    transitions: {
      "Awaiting documents": ["Submitted"],
      Submitted: ["Duty pending", "Inspection", "Released"],
      "Duty pending": ["Inspection", "Released"],
      Inspection: ["Released"],
      Released: ["Closed"],
      Closed: [],
    },
  },
  {
    moduleKey: "delivery",
    label: "Delivery",
    initial: "Dispatch pending",
    statuses: ["Dispatch pending", "In transit", "Delivered", "Closed"],
    transitions: {
      "Dispatch pending": ["In transit"],
      "In transit": ["Delivered"],
      Delivered: ["Closed"],
      Closed: [],
    },
  },
  {
    moduleKey: "grn",
    label: "GRN & closure",
    initial: "Awaiting posting",
    statuses: ["Awaiting posting", "Partial", "Posted", "Pending closure", "Closed"],
    transitions: {
      "Awaiting posting": ["Partial", "Posted"],
      Partial: ["Posted", "Pending closure"],
      Posted: ["Pending closure", "Closed"],
      "Pending closure": ["Closed"],
      Closed: [],
    },
  },
];

export const machineByKey = Object.fromEntries(STATUS_MACHINES.map((m) => [m.moduleKey, m]));
