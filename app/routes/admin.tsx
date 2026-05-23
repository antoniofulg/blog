import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminSidebar } from "#/components/admin/sidebar";

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
});

function AdminLayout() {
	return (
		<div className="flex flex-col md:flex-row">
			{/* Mobile: top border; Desktop: right border + fixed width */}
			<aside className="border-b border-border bg-surface md:w-56 md:flex-shrink-0 md:border-b-0 md:border-r">
				<AdminSidebar />
			</aside>
			<div className="min-w-0 flex-1">
				<Outlet />
			</div>
		</div>
	);
}
