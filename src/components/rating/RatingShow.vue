<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  rating?: number
  editable?: boolean
}>(), {
  rating: 0,
  editable: false,
})

const emit = defineEmits(['ratingClick'])

const hoverRating = ref(0)

const displayStars = computed(() =>
  Array.from({ length: 5 }, (_, index) => ({
    isFilled: index + 1 <= props.rating,
    value: index + 1,
  })),
)

const starStates = ref(displayStars.value)

watch(() => props.rating, () => {
  starStates.value = displayStars.value
}, { immediate: true })

function handleStarClick(value: number) {
  emit('ratingClick', value)
}
</script>

<template>
  <div class="hp-stars" :class="{ 'hp-stars--editable': editable }">
    <button
      v-for="star in starStates"
      :key="star.value"
      type="button"
      class="hp-stars__item"
      :class="{
        'hp-stars__item--on': star.isFilled || (editable && star.value <= hoverRating),
        'hp-stars__item--readonly': !editable,
      }"
      :disabled="!editable"
      :aria-label="`${star.value} 星`"
      @click="editable && handleStarClick(star.value)"
      @mouseover="editable && (hoverRating = star.value)"
      @mouseleave="editable && (hoverRating = 0)"
    >
      ★
    </button>
  </div>
</template>

<style scoped lang="scss">
.hp-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.hp-stars__item {
  padding: 0;
  border: none;
  background: none;
  font-size: 16px;
  line-height: 1;
  color: #d1d5db;
  cursor: default;
  transition:
    color 0.12s ease,
    transform 0.12s ease;

  &--on {
    color: var(--chat-accent);
  }

  &--readonly {
    pointer-events: none;
  }
}

.hp-stars--editable .hp-stars__item {
  font-size: 28px;
  cursor: pointer;

  &:hover {
    transform: scale(1.08);
  }
}

body.dark-mode .hp-stars__item {
  color: #4b5563;

  &--on {
    color: var(--chat-accent);
  }
}
</style>
