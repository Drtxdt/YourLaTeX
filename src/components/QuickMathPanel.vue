<script setup lang="ts">
const emit = defineEmits<{
  insert: [latex: string]
}>()

const symbols = [
  { symbol: 'α', latex: '\\alpha ' },
  { symbol: 'β', latex: '\\beta ' },
  { symbol: 'γ', latex: '\\gamma ' },
  { symbol: '∑', latex: '\\sum_{i=1}^{n} ' },
  { symbol: '∫', latex: '\\int_{a}^{b} ' },
  { symbol: 'x/y', latex: '\\frac{ }{ }' },
  { symbol: '√', latex: '\\sqrt{ }' },
  { symbol: '∞', latex: '\\infty ' },
  { symbol: '·', latex: '\\cdot ' },
  { symbol: '±', latex: '\\pm ' },
  { symbol: '≤', latex: '\\leq ' },
  { symbol: '≥', latex: '\\geq ' },
  { symbol: '⇒', latex: '\\Rightarrow ' },
  { symbol: '∀', latex: '\\forall ' },
]
</script>

<template>
  <section class="quick-math-panel">
    <div class="panel-title">Quick Math Symbols</div>
    <div class="symbol-grid">
      <button
        v-for="item in symbols"
        :key="item.latex"
        type="button"
        class="symbol-btn"
        @click="emit('insert', item.latex)"
      >
        <span class="symbol-glyph">{{ item.symbol }}</span>
        <span class="symbol-latex">{{ item.latex }}</span>
      </button>
    </div>
  </section>
</template>
