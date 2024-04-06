<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { ReqBody } from '../../api/src/models/ReqBody';
import type { CardsResp } from '../../api/src/models/CardsResp';
import Loader from './components/Loader.vue';
import { nanoid } from 'nanoid'
import { Site } from "../../api/src/constants/sites";


const form = reactive({
  sources: [
    'https://www.moxfield.com/decks/C7cMWK5PzE6jbVuTFh916g',
    'https://www.moxfield.com/decks/0Vqrb1PCT06gr7hsq-4u0A',
    'https://deckbox.org/sets/2205627?s=i&o=d'
  ].join('\n'),
  cards: [
    'Negate',
    'Abhorrent Overlord',
    'Elspeth, Sun\'s Champion',
    'Don\'t Move',
    'Dragonlord\'s Servant'
  ].join('\n'),
});
const searchData = ref<CardsResp | null>(null);
const isLoading = ref(false);
const crawlProgress = ref<{ [key in Site]: { total: number; current: number } } | null>(null)

const stringToArr = (string: string) => string.split('\n').filter(Boolean);

const transformUrls = (arr: string[]) => {
  return arr.map(e => prettyString(e));
}

function prettyString(str: string) {
  str = replaceAll(str, '\"', '');
  str = replaceAll(str, ',', '');
  str = replaceAll(str, '\'', '');
  return str.trim();
}

function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(find, 'g'), replace);
}

async function onSubmit() {
  isLoading.value = true;
  const body: ReqBody = {
    sources: stringToArr(form.sources).map(e => prettyString(e)),
    cards: stringToArr(form.cards),
  };

  try {
    const trackingTM = handleProgressTracking();
    const resp = await fetch(`http://0.0.0.0:8888/api/cards?userId=${getUserId()}`, { method: 'POST', body: JSON.stringify(body) });
    const data = await resp.json();
    searchData.value = data ?? {};
    clearTimeout(trackingTM)

    setTimeout(() => {
      document.querySelector('#results')?.scrollIntoView({
        behavior: 'smooth'
      });
    }, 100)
  }
  catch (e) {
    console.error('Ooops', e);
  }
  finally {
    isLoading.value = false;
  }
}

const getUserId = () => {
  const userId = sessionStorage.getItem('userId');
  if (!userId) {
    const id = nanoid()
    sessionStorage.setItem('userId', id);
    return id;
  }
  return userId;
}

const handleProgressTracking = () => {
  return setTimeout(() => {
    const events = new EventSource(`http://0.0.0.0:8888/api/cards/sse?userId=${getUserId()}`);
    events.onmessage = (event) => {
      crawlProgress.value = JSON.parse(event.data);
    };
    events.onerror = (event) => {
      if (event.eventPhase === EventSource.CLOSED) {
        events.close();
        crawlProgress.value = null;
      } else {
        console.error('Error with SSE: ', event)
      }
    };
  }, 1000)

}
</script>

<template>
  <Transition>
    <div v-if="isLoading" class="loadingOverlay">
      <Loader />
      <p v-if="crawlProgress?.moxfield.total">Moxfield pages progress: {{ crawlProgress.moxfield.current }}/{{
      crawlProgress.moxfield.total }}</p>
      <p v-if="crawlProgress?.deckbox.total">Deckbox pages progress: {{ crawlProgress.deckbox.current }}/{{
      crawlProgress.deckbox.total }}</p>
    </div>
  </Transition>
  <div class="content">
    <h1 class="pageTitle">
      Your wishlist,<br>
      found efortlessly.
    </h1>

    <form class="form" @submit.prevent="onSubmit">
      <div class="row">
        <label for="sourcess">
          Links to
          <span class="source deckbox">
            <img src="https://deckbox.org/favicon.ico" alt="moxfield favicon">Deckbox
          </span>
          or
          <span class="source moxfield">
            <img src="https://www.moxfield.com/favicon.ico" alt="moxfield favicon"> Moxfield
          </span>
          decks and pages
        </label>
        <textarea id="sourcess" v-model="form.sources" name="sourcess" cols="30" rows="4"
          placeholder="List each ID on a new row ..." required />
      </div>

      <div class="row">
        <label for="cards">Card names</label>
        <textarea id="cards" v-model="form.cards" name="cards" cols="30" rows="6"
          placeholder="List each card name on a new row ..." required />
      </div>
      <button type="submit">
        Submit
      </button>
    </form>

    <template v-if="searchData">
      <h2 id="results">Results</h2>

      <section class="results">
        <article v-for="(cards, sourceLink) in searchData" :key="sourceLink">
          <h2 class="title">
            <a :href="sourceLink.toString()" class="" target="_blank" rel="noopener noreferrer">{{ sourceLink }}</a>
          </h2>
          <ul>
            <li v-for="card in cards" :key="card.id">
              <VTooltip placement="top-start">
                <span>{{ card.name }}</span>

                <template #popper>
                  <img class="imgPreview" :src="card.imgUrl" alt="">
                </template>
              </VTooltip>
            </li>
          </ul>
        </article>
      </section>
    </template>
  </div>
</template>

<style>
.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}


.v-popper {
  display: inline-block;
}

.v-popper--theme-tooltip .v-popper__inner {
  padding: 0 !important;
  border-radius: 12px;
}
</style>

<style lang="scss" scoped>
.loadingOverlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  z-index: 10;
  background-color: var(--pico-contrast-focus);
  backdrop-filter: blur(4px);
  /* You may adjust the blur value as needed */
  font-size: 1.25rem;

  &>div+p {
    margin-top: 1rem;
  }

  &>p {
    font-weight: bold;
    text-shadow: -1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000;
    margin-bottom: 0.5rem;
  }
}

.content {
  position: relative;
  margin-left: auto;
  margin-right: auto;
  max-width: 1440px;
  padding: 0.75rem;

  @media (min-width: 1024px) {
    & {
      padding: 1.5rem;
    }
  }

  @media (min-width: 768px) {
    & {
      padding: 1rem;
    }
  }

  .pageTitle {
    background: linear-gradient(to right, #FFFFFF 0%, var(--pico-primary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    margin-left: auto;
    margin-right: auto;
    max-width: 42rem;
    text-align: center;
    font-size: 2.25rem;
    line-height: 2.5rem;
    text-transform: uppercase;
  }
}

.form {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  margin-left: auto;
  margin-right: auto;
  max-width: 40rem;
  width: 100%;
  gap: 1rem;

  .row label {
    width: 100%;
    font-size: 1.25rem;
    line-height: 1.75rem;
  }

  .source {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;

    &.deckbox {
      color: #e38824;
    }

    &.moxfield {
      color: #e85485;
    }
  }
}

article .title {
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.results {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
  /* Default gap */

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    gap: 1.5rem;
  }
}

.imgPreview {
  width: 12rem;
  border-radius: 12px;
  overflow: hidden;
}
</style>
