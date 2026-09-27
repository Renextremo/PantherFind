export type PickupContact = {
  name: string;
  location: string;
  phone: string;
};

const contacts: PickupContact[] = [
  { name: "Graham Center Lost and Found", location: "MMC · Graham Center, Desk 181", phone: "305-348-1735" },
  { name: "Green Library", location: "MMC · Check Out Desk, GL-290 (2nd floor)", phone: "305-348-2451" },
  { name: "Hubert Library", location: "BBC · Circulation Desk, LIB-106 (1st floor)", phone: "305-919-5718" },
  { name: "Wolfe University Center", location: "BBC · Welcome Desk, WUC 110A", phone: "305-919-5224" },
  { name: "FIU Police (non-emergency)", location: "Call to ask where the item was transferred", phone: "305-348-2626" },
];

export function getPickupContacts(campus = "", location = ""): PickupContact[] {
  const value = `${campus} ${location}`.toLowerCase();
  if (/graham|gc\b/.test(value)) return [contacts[0], contacts[4]];
  if (/green librar|\bgl\b/.test(value)) return [contacts[1], contacts[4]];
  if (/hubert librar|\blib\b/.test(value)) return [contacts[2], contacts[4]];
  if (/wolfe|university center|\bwuc\b/.test(value)) return [contacts[3], contacts[4]];
  if (/bbc|bay campus|biscayne/.test(value)) return [contacts[2], contacts[3], contacts[4]];
  if (/mmc|modesto|miami campus/.test(value)) return [contacts[0], contacts[1], contacts[4]];
  return [contacts[4]];
}

export const FIU_LOST_FOUND_URL = "https://facilities.fiu.edu/MaintenanceAndOperations/workmanagement";
