import assert from "node:assert/strict";
import { test } from "node:test";
import { coordinatorPathAllowed } from "./coordinator-access";
import { employeeHome } from "./employee-day";

test("Coordinator allows production, tickets, employee day and preventive/cleaning forms only", () => {
  for (const path of ["/", "/login", "/alterar-password", "/funcionario", "/funcionario/equipa", "/producao", "/tickets", "/api/producao/lot/export", "/equipamentos/mcc/rotina-diaria", "/equipamentos/mcc/rotina-diaria/pdf"]) assert.equal(coordinatorPathAllowed(path), true, path);
  for (const path of ["/inventario", "/despesas", "/plano", "/manutencao", "/acessos", "/equipamentos", "/equipamentos/mcc", "/equipamentos/mcc/checklist-interna", "/api/inventario/pdf", "/api/manutencao/ops/id/pdf", "/producao-other", "/tickets-extra", "/equipamentos/mcc/rotina-diaria/pdf/other"]) assert.equal(coordinatorPathAllowed(path), false, path);
  for (const role of ["ADMIN", "MANAGER", "USER", "TICKET", "SGQ", "HSA"]) assert.equal(employeeHome(role, true), "/funcionario");
  assert.equal(employeeHome("ADMIN", false), "/");
});
