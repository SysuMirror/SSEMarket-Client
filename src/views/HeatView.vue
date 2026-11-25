<script setup lang="ts">
import { onMounted } from 'vue'
import { trackEvia } from '@/analytics/evia'
import HeatList from '@/components/HeatList.vue'

onMounted(() => trackEvia('hot_list_viewed', { tab: 'default' }))
</script>

<template>
  <HeatList />
</template>
