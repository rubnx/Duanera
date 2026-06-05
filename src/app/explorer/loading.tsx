import {
  AppShell,
  AppShellContent,
  AppShellMain,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableLoading,
  DataTableRow,
  DataTableShell,
  DataTableTitle,
  DataTableToolbar,
  Sidebar,
  SidebarBrand,
  SidebarInner,
  SidebarItem,
  SidebarSection,
} from "@/components/explorer"
import { CountryFlag } from "@/components/common/country-flag"

function SkeletonCell({ width = 96 }: { width?: number }) {
  return (
    <div
      className="h-3 rounded-ds-sm bg-ds-muted"
      style={{ maxWidth: "100%", width }}
    />
  )
}

export default function ExplorerLoading() {
  return (
    <AppShell
      sidebar={
        <Sidebar>
          <SidebarInner>
            <SidebarBrand>
              <CountryFlag
                countryCode="CL"
                countryName="Chile"
                className="h-6 !w-9 rounded-[3px] !bg-[length:100%_100%]"
              />
              <span>Duanera</span>
            </SidebarBrand>
            <SidebarSection>
              <SidebarItem active href="#">
                Explorador
              </SidebarItem>
            </SidebarSection>
          </SidebarInner>
        </Sidebar>
      }
    >
      <AppShellMain>
        <AppShellContent>
          <div className="h-8 w-36 rounded-ds-md bg-ds-muted" />
          <section
            aria-label="Resumen del resultado"
            className="overflow-hidden rounded-ds-md border border-ds-border-soft bg-ds-surface/80"
          >
            <div className="grid grid-cols-2 divide-y divide-ds-border-soft sm:grid-cols-4 lg:grid-cols-8 lg:divide-y-0">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="border-r border-ds-border-soft px-2.5 py-1.5 last:border-r-0"
                >
                  <SkeletonCell width={64} />
                  <div className="mt-2">
                    <SkeletonCell width={88} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <DataTableShell className="overflow-hidden rounded-ds-lg border border-ds-border-soft">
            <DataTableToolbar>
              <DataTableTitle>Cargando registros</DataTableTitle>
            </DataTableToolbar>
            <DataTable loading>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Fecha</DataTableHead>
                  <DataTableHead>Correlativo Aduana</DataTableHead>
                  <DataTableHead>Producto HS</DataTableHead>
                  <DataTableHead>País</DataTableHead>
                  <DataTableHead>Fuente</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody className="animate-pulse">
                {Array.from({ length: 8 }, (_, index) => (
                  <DataTableRow key={index}>
                    <DataTableCell><SkeletonCell /></DataTableCell>
                    <DataTableCell><SkeletonCell width={128} /></DataTableCell>
                    <DataTableCell><SkeletonCell width={256} /></DataTableCell>
                    <DataTableCell><SkeletonCell width={112} /></DataTableCell>
                    <DataTableCell><SkeletonCell width={160} /></DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <DataTableLoading />
          </DataTableShell>
        </AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
