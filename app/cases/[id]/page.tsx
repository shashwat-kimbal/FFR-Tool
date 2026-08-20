import { redirect } from "next/navigation";

export default async function CaseIndexPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/cases/${id}/verdict`);
}
