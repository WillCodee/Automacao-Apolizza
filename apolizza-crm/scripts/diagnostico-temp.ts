import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });

  // 1. Usuários ativos
  const [users] = await conn.execute(
    "SELECT id, name, username, role, is_active FROM users WHERE is_active = 1 ORDER BY role, name"
  );
  console.log("=== USUÁRIOS ATIVOS ===");
  console.table(users);

  // 2. Grupos
  const [grupos] = await conn.execute(
    "SELECT id, nome FROM grupos_usuarios ORDER BY nome"
  );
  console.log("\n=== GRUPOS ===");
  console.table(grupos);

  // 3. Membros dos grupos
  const [membros] = await conn.execute(`
    SELECT gm.grupo_id, gu.nome as grupo_nome, gm.user_id, u.name as user_name
    FROM grupo_membros gm
    JOIN grupos_usuarios gu ON gu.id = gm.grupo_id
    JOIN users u ON u.id = gm.user_id
    ORDER BY gu.nome, u.name
  `);
  console.log("\n=== MEMBROS DOS GRUPOS ===");
  console.table(membros);

  // 4. Distribuição atual de cotacoes por assignee_id
  const [assignees] = await conn.execute(`
    SELECT u.name, c.assignee_id, COUNT(*) as total
    FROM cotacoes c
    LEFT JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
    GROUP BY c.assignee_id, u.name
    ORDER BY total DESC
  `);
  console.log("\n=== COTAÇÕES POR ASSIGNEE ===");
  console.table(assignees);

  // 5. Distribuição por produto
  const [produtos] = await conn.execute(`
    SELECT produto, COUNT(*) as total
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY produto
    ORDER BY total DESC
  `);
  console.log("\n=== COTAÇÕES POR PRODUTO ===");
  console.table(produtos);

  // 6. Situacoes distintas (para entender CCliente)
  const [situacoes] = await conn.execute(`
    SELECT situacao, COUNT(*) as total
    FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY situacao
    ORDER BY total DESC
  `);
  console.log("\n=== SITUAÇÕES DISTINTAS ===");
  console.table(situacoes);

  // 7. Cotações CCliente já existentes
  const [ccliente] = await conn.execute(`
    SELECT COUNT(*) as total FROM cotacoes
    WHERE deleted_at IS NULL AND LOWER(situacao) LIKE '%cliente%'
  `);
  console.log("\n=== TOTAL CCLIENTE ===");
  console.table(ccliente);

  // 8. Co-responsáveis já registrados
  const [coResp] = await conn.execute(`
    SELECT cr.cotacao_id, cr.user_id, u.name
    FROM cotacao_responsaveis cr
    JOIN users u ON u.id = cr.user_id
    LIMIT 20
  `);
  console.log("\n=== CO-RESPONSÁVEIS (amostra) ===");
  console.table(coResp);

  // 9. grupo_id atual nas cotacoes
  const [gruposCotas] = await conn.execute(`
    SELECT grupo_id, COUNT(*) as total FROM cotacoes
    WHERE deleted_at IS NULL
    GROUP BY grupo_id
    ORDER BY total DESC
  `);
  console.log("\n=== GRUPO_ID NAS COTAÇÕES ===");
  console.table(gruposCotas);

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
