/** Clearances that follow the worker to any client, so they are reused on every redeployment. */
export const isGeneralClearance = (label: string): boolean => {
  const norm = label.toLowerCase();
  return (
    norm.includes("nbi") ||
    norm.includes("philhealth") ||
    norm.includes("sss") ||
    norm.includes("pag-ibig") ||
    norm.includes("pagibig") ||
    norm.includes("tin") ||
    norm.includes("bir") ||
    norm.includes("government") ||
    norm.includes("valid id") ||
    norm.includes("police")
  );
};
