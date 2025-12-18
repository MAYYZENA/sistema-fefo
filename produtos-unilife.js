// Catálogo COMPLETO de Produtos - Edin (Todas as Marcas)
// Para adicionar código de barras, edite o campo 'codigo'

const produtosEdin = [
  // MAGNÉSIO
  { nome: "Magnésio Citrato 60 cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Magnésio Quelato 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Treon Mag Magnésio Treonato 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Magneclor Cloreto de Magnésio P.A 1kg", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // VITAMINA B12
  { nome: "Vitamina B12 Metilcobalamina 60 cápsulas", marca: "Unilife", categoria: "Vitaminas", codigo: "", fornecedor: "Edin" },
  { nome: "Vitamina B12 Cianocobalamina 60 cápsulas", marca: "Unilife", categoria: "Vitaminas", codigo: "", fornecedor: "Edin" },
  
  // OUTRAS VITAMINAS B
  { nome: "Vitamina B1 Tiamina 60 cápsulas", marca: "Unilife", categoria: "Vitaminas", codigo: "", fornecedor: "Edin" },
  { nome: "Vitamina B5 Ácido Pantotênico 60 cápsulas", marca: "Unilife", categoria: "Vitaminas", codigo: "", fornecedor: "Edin" },
  { nome: "Vitamina B6 Piridoxina 60 Cápsulas", marca: "Unilife", categoria: "Vitaminas", codigo: "", fornecedor: "Edin" },
  
  // VITAMINA A
  { nome: "Vitamina A Retinol 60 Cápsulas", marca: "Unilife", categoria: "Vitaminas", codigo: "", fornecedor: "Edin" },
  
  // COLÁGENO
  { nome: "Colágeno tipo 2 II 40mg Regeneflex Osteo", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Condrol Dimalex 1100mg 60 Comprimidos", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ORA-PRO-NÓBIS
  { nome: "Ora pro nóbis Pereskia Aculeata 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ÓLEOS
  { nome: "Óleo de Semente de Linhaça Dourada 1000mg 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Óleo de Semente de Linhaça Dourada 1000mg 120 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ÔMEGA
  { nome: "Ômega 3 Vegetal 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // COENZIMA
  { nome: "Coenzima CoQ-10 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // CRANBERRY
  { nome: "Cranberry 120 cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // LISINA
  { nome: "NoHerps Lisina 1000mg 90 comprimidos Laranja e Acerola", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // PSYLLIUM
  { nome: "Psyllium Psylliumax 120 cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // CLORELLA
  { nome: "Clorella 500mg 60 cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // LUTEÍNA
  { nome: "Luteína e Zeaxantina 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // PRÓPOLIS
  { nome: "Própolis Verde + Vitamina C Zinco e Selênio 60 cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // SELÊNIO
  { nome: "Selênio Quelato 60 Cápsulas", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // MATCHA
  { nome: "Matcha Puro Vegano 30g Solúvel", marca: "Unilife", categoria: "Alimentos", codigo: "", fornecedor: "Edin" },
  
  // SHAKE
  { nome: "Shake Diet com Colágeno Fini Belt 400g Chocolate", marca: "Unilife", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // SUPRAMIL (Bebidas de Arroz)
  { nome: "Supramil Bebida de Arroz Kids 200g", marca: "Unilife", categoria: "Bebidas", codigo: "", fornecedor: "Edin" },
  { nome: "Supramil Bebida de Arroz Kids 500g", marca: "Unilife", categoria: "Bebidas", codigo: "", fornecedor: "Edin" },
  { nome: "Supramil Bebida de Arroz Kids 1Kg", marca: "Unilife", categoria: "Bebidas", codigo: "", fornecedor: "Edin" },
  { nome: "Supramil Bebida de Arroz Kids Chocolate 500g", marca: "Unilife", categoria: "Bebidas", codigo: "", fornecedor: "Edin" },
  { nome: "Supramil Bebida de Arroz Kids Morango 500g", marca: "Unilife", categoria: "Bebidas", codigo: "", fornecedor: "Edin" },
  
  // ========== QUALICÔCO ==========
  { nome: "Óleo de Coco Extra Virgem 200ml", marca: "Qualicôco", categoria: "Alimentos", codigo: "", fornecedor: "Edin" },
  { nome: "Óleo de Coco Extra Virgem 500ml", marca: "Qualicôco", categoria: "Alimentos", codigo: "", fornecedor: "Edin" },
  
  // ========== VITAFOR ==========
  { nome: "Curcuma Plus 60 Cápsulas", marca: "Vitafor", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Simfort Ultra 6 Cepas Probióticos 60 Cápsulas", marca: "Vitafor", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Probióticos Simfort Mix 30 Sachês de 2g", marca: "Vitafor", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  { nome: "Isofort Plant 450g Banana com Canela", marca: "Vitafor", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== CATARINENSE ==========
  { nome: "Artro Ultra Colágeno Tipo II 30 Cápsulas", marca: "Catarinense", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== PAZZE ==========
  { nome: "Óleo de Semente de Abóbora Extra Virgem 250ml", marca: "Pazze", categoria: "Alimentos", codigo: "", fornecedor: "Edin" },
  
  // ========== OCEAN DROP ==========
  { nome: "Ômega 3", marca: "Ocean Drop", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== APISNUTRI ==========
  { nome: "Própolis", marca: "Apisnutri", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== CLINIC MAIS ==========
  { nome: "Suplementos", marca: "Clinicmais", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== NUTRIFY ==========
  { nome: "Suplementos", marca: "Nutrify", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== MAXINUTRI ==========
  { nome: "Suplementos", marca: "Maxinutri", categoria: "Suplementos", codigo: "", fornecedor: "Edin" },
  
  // ========== DUX HUMAN HEALTH ==========
  { nome: "Suplementos", marca: "Dux Human Health", categoria: "Suplementos", codigo: "", fornecedor: "Edin" }
];

// Função para importar produtos para o Firebase
async function importarProdutosEdin() {
  if (!window.firebase || !window.db) {
    alert('Sistema não inicializado. Aguarde e tente novamente.');
    return;
  }
  
  if (!window.auth.currentUser) {
    alert('Você precisa estar logado para importar produtos!');
    return;
  }
  
  const confirmacao = confirm(
    `Deseja importar ${produtosEdin.length} produtos do catálogo Edin?\n\n` +
    'Isso NÃO vai adicionar ao estoque, apenas cria um catálogo de referência.\n' +
    'Você ainda precisará adicionar quantidade, lote e validade depois.'
  );
  
  if (!confirmacao) return;
  
  mostrarLoader(true);
  let importados = 0;
  let erros = 0;
  
  try {
    // Cria uma coleção separada para o catálogo
    for (const produto of produtosEdin) {
      try {
        await window.db.collection('catalogo-produtos').add({
          ...produto,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        importados++;
      } catch (e) {
        console.error('Erro ao importar produto:', produto.nome, e);
        erros++;
      }
    }
    
    mostrarLoader(false);
    mostrarToast(`✅ ${importados} produtos importados! ${erros > 0 ? `(${erros} erros)` : ''}`);
    
  } catch (e) {
    mostrarLoader(false);
    console.error('Erro na importação:', e);
    mostrarToast('Erro ao importar produtos. Veja o console (F12).', true);
  }
}

// Expor função globalmente
if (typeof window !== 'undefined') {
  window.importarProdutosEdin = importarProdutosEdin;
  window.produtosEdin = produtosEdin;
}
