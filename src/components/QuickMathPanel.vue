<script setup lang="ts">
const emit = defineEmits<{
  insert: [latex: string]
}>()

const symbols = [
  { label: 'alpha', latex: '\\alpha ' },
  { label: 'beta', latex: '\\beta ' },
  { label: 'gamma', latex: '\\gamma ' },
  { label: 'sum', latex: '\\sum_{i=1}^{n} ' },
  { label: 'int', latex: '\\int_{a}^{b} ' },
  { label: 'frac', latex: '\\frac{ }{ }' },
  { label: 'sqrt', latex: '\\sqrt{ }' },
  { label: 'infty', latex: '\\infty ' },
  { label: 'cdot', latex: '\\cdot ' },
  { label: 'pm', latex: '\\pm ' },
  { label: 'leq', latex: '\\leq ' },
  { label: 'geq', latex: '\\geq ' },
  { label: 'Rightarrow', latex: '\\Rightarrow ' },
  { label: 'forall', latex: '\\forall ' },
]
</script>

<template>
  <section class="quick-math-panel">
    <div class="panel-title">Quick Math Symbols</div>
    <div class="symbol-grid">
      <button
        v-for="item in symbols"
        :key="item.label"
        type="button"
        class="symbol-btn"
        @click="emit('insert', item.latex)"
      >
        {{ item.label }}
      </button>
    </div>
  </section>
</template>
