
// ── OAUTH CALLBACKS — capture at page load before anything else ──
(function() {
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code'), state = p.get('state'), err = p.get('error');

  // GBP OAuth — redirect to dedicated callback page
  if (code && state === 'gbp_oauth') {
    window.location.replace('/gbp-callback/?code=' + encodeURIComponent(code) + '&state=gbp_oauth');
    return;
  }

  // Meta OAuth — capture code for handleMetaOAuth()
  if (state === 'meta_oauth') {
    if (code) {
      window._metaOAuthCode = code;
    } else if (err) {
      window._metaOAuthError = err + (p.get('error_description') ? ': ' + p.get('error_description') : '');
    }
    // Clean URL immediately
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// ── CONFIG ──
const MKT_SB_URL = 'https://ndamdnlsuktucqtcbhgp.supabase.co';
const MKT_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYW1kbmxzdWt0dWNxdGNiaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTg1MzgsImV4cCI6MjA5Njk5NDUzOH0.7pGJu4bbNhl4E-4Do24jS9_p6nLUa1eN4JXQSqEF9VU';

// Strip content-type suffixes from topic for clean display
function cleanTopic(topic) {
  return (topic||'')
    .replace(/\s*[—–\-]\s*(GIF|Reel|Reels|Video|Slideshow|Animation|Animated|Campaign|GIF Campaign|GIF Comparison|GIF Slideshow)\s*/gi, '')
    .replace(/\b(GIF|Slideshow|Animated)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

let _musicPreviewAudio = null;
let _uploadedMusicURL = null;

let MKT_MUSIC_TRACKS = [
  { id:'none', label:'No Music (GIF only)', url:null, mood:'silent', attribution:null }
];

// Load tracks from DB on startup
async function loadMusicTracks() {
  try {
    const { data } = await sb.from('music_tracks').select('*').eq('is_active', true).order('mood').order('title');
    if (data && data.length) {
      MKT_MUSIC_TRACKS = [
        { id:'none', label:'No Music (GIF only)', url:null, mood:'silent', attribution:null },
        ...data.map(t => ({
          id: t.id,
          label: t.title + (t.artist ? ' — ' + t.artist : ''),
          url: t.public_url,
          mood: t.mood,
          attribution: t.attribution_text
        })),
        { id:'upload', label:'📁 Upload Your Own MP3', url:'__upload__', mood:'custom', attribution:null }
      ];
      // Refresh any open music picker
      const sel = document.getElementById('mkt-music-select');
      if (sel) {
        const cur = document.getElementById('mkt-music-value')?.value || 'none';
        const parent = sel.closest('div');
        if (parent) parent.outerHTML = mktMusicPickerHTML(cur);
      }
    }
  } catch(e) { console.warn('Music tracks load failed:', e); }
}



// ── Auto poster generation via generate-poster-v2 ──
const VW_LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAZAAAACnCAYAAAA/twptAAA4hElEQVR4nO2deXwcxZn3n+qeQ/dp4/tCNocNOGCHOMmC5YWNCRtDSLCTzbm8CbCbhFwOScgl603yZkk2u3EOss5CSELYJGMDtgFDsL0jcIwxCFu2ZUmWrPs+ZqS5j57u5/1jquTWaEaaGY2kGfn5fj79kT0zXfVUdXX9+qmnqhqAIOYAiCgBAOzcuTN3YGDgWbfLFXK5XK6erq5HxfeIyGbXSoIgCCKtQESJMQYPPPBAjt1mewXDqPwvtra2/ob/TiYRIQiCIABgnHj8L9cMBRFR07TRf7e1tf1W/J5EhCAI4jJHLx42Lh6qqio4niAXkSf4eeSJEARBXK5EEw/hbcQgiIjY0tIiPBESEYIgiMsNIR4VumGrGJ5HLE+ERIQgCOJyQy8etqEhawLiEUtEKCZCEAQx1xkVj4qKHLvdnojnQZ4IQRDE5YpePGw2WzKeB3kiBEEQlxtCPHbu3JmbIvEYKyItLU+KfEhECIIg5gjTKB5jRaStjUSEIAhirqAXD7vdPh3iQSJCEAQx18CxnkfVNIoHiQhBEMRcYRbEY6yItLb+TthBIkIQBJEhRBWPiVeYT4+ItLX9TthDIkIQBJHm6MVjeHh4Jj0PEhGCIIhMBcd6Hq/OoniQiBAEQWQKQjx+8pOfpIt4CERM5PfCTiQRIQiCmDqIyHinOulRUVEhxUhDrDDPE+KBMxvzmAwSEYIgiHQDdeIxnF6eRyRiOItEhCB00E1AJAMDAHzh6aeLsxcuvELTNJQkaUxbMhqNqCgK0zQNjUYjAkCW1Wo9X1lZqQGEO2FJkrTvfe97eV/+8pdfLCoquhUAQgBgmPnixIUCAMb29vY/rFy58tMYfgc7MsZwtg0jCILIGBDRAABQU1PzVZ/Pp/l8viD/G3moPp9PCQaDeLamZifqhrxGPY/h4XQctooFeSIEQRBTAbmANDQ0fJV3rKEYHW4IEbGjo+Nr/Lwx4mGz2V5DTNthq1gEERFbW1v/oCsTiQhBEEQ8IBeQurq6ryKixjtVDRE1TdNQVVUNuUfR3Ny8U5xjsVhkABgjHphZ4iEIIiK2k4gQBEEkBo4VEMSxw08acs9jMvHgnoemqmoIEUOoqml9CDv5Xx8iYgvfCp6Xk0SEIAhiIiYQkJieB2MMLBZLnmNk5LUoopPRdHd2Hjj01FMFSJ4IcZmRrjNeiMwDAUAFAENbW9vOsrKy/0BEw969e3HHRz6iVnzve3k3vuMdh4wm0y1DQ0MhxpgMAGCQ5S5zVlaNpmkSY0yb3SIkDmMsVFxaWrB47do7GWN/Rj47a7btIgiCSEuQeyC1Z88KDySIfNiqtbn5q+I3Ytjq4Ycfzrfb7ccQERVFUUKhkP7vE7NZFoIgCGIGiSIgfkTE5kjxYAweffTRUfHAscNW4t9PIaKMiGb+V25sbDTz/ydyGMX5s3HM7hUhCILIEISAnDl9+iuIqEYVDwB49NFH84e5eESZqiv+/wd9mgRBZA500xJJYzabGQBIra2tXywrK/vFaMxjxw710UcfzX/g/vsPFRUX/x0AhCRJiretSY2Njf9SUlJSpKoqMsYmDEojoibLsmS32//3qquuegPD60zSJpZSUVEh7dq1i1asEwRBAABYrVYDAMCbb7zxrZaWlh8ARPE8hoejDVtN6IFwrTAMDg7aY5wTk46OjgqRzuzUyngwHFAX0OwsgiAIwec///lSgHBHqRcPu93+t0nEY0IBGRoaauTfB/jfiQ4fIiq61e5pISCiPvbv3794w4YNRsYYrRMhCILQg4gswvOIRzwmFBDb0FAL/06dJI3RdDo6Or4u0pm92ggjPLSampqr3G53X3d3twWAVqwTBEHoSVY85qyACPGoP3Pmaq/X2yWM7Ozs/CO3j0SEIAhCvCSqoqKiIEHxmJMCIsTj7Nmz1/h8vi5ERL7tiYKI2N7e/jS3kUSEIIjLF9EB7t69OxnxmHMCEk08cOwuxUFExE4SEYIgLmeQv9fDarVmjYyMvKrvIC9HAYlDPMaKSGcniQhBEJcnosPs6Oi4J0nxmDMCohcPv9+vH7aKBYkIQRCXL6KTHh4e/hrv5JPZWTfjBUSIR4NOPDD2y7X0jBERmuJLZCqzPuWRyFwURdEAQAKAlKz8Rgwv1p5k8XlaYLVaDVu2bAk1NDRcs2LFiqNms3kxhHcjjmdfLCMAKEuXLv1Ye3s77tu3734ACPDvaMU6kTFIk/+EIAg9QjzOnTt37YoVK45mZWUlIh4CIwD4ly9f/vF77rnnIcaYhrQpI5FhkAdCEAmgF481a9YcSdDz0BMCgCyv13vIZDI9geFtT9SUG0wQ0wh5IAQRJ0I8Lly4MCXx0DQtBAAGr9f78uOPP/6hpUuX2gAAGWNYUVEhcU8k/cfxCIIgEkUEqgcGBqK9Ez1eYm3nbrDbbGkXRBcB8wsXLlzr9/u7ed7xBMwjCSIiejyel3bv3m3mAXSxIHP0gY7HgUhECIKYW+BlJiCpEg/xThSXyzVOPJDHP06ePLmuraXlP/lnDGl2FkEQcwm8jAREpFdbW7s2VeLx0EMPjREPIVBWq3W12+1uQUTs6up6GgAYIkp6z4QgCCKjEZ1qX1/fnBYQ0bE3NjauDQQCKREPi8ViiuZ5WK3W1S6Xq42f4kdE7O7u/hNwEUHyRAiCmAvgZSAgIp3Gxsa1fr+/h+eVdMzD5XS+VFFRYZrA82hDHLOKPYg4VkTIEyEIIuPBOS4ges9jKuKh8zwOVVRUmJDvIabPI4Z4CMIi0tn5ZyBPhCCIuQDOYQHBFHkekeIRy/NwuVzt/Pex8hCeCIkIQRCZD85RAUGdeARSMWw1iecRh3iMSY9EhCCIjAfTUEC6u7unJCCiY29ra1sbCASmddjqlVdeWZOAeAiCiIg9JCIEQWQymIYC0tvbm7SAiHOamprW+f3+Xp7uVDyPF1MsHmPS7+7s/AtQYJ0giEwE55CA4AyKR9XUxGNMPt3d3aMiguSJEASRKeAcERCcYfFwT108xuSnFxHyRAiCyAhEx9vT05OxAoI68QgEAkmLhy7mEVs8qqrWuN3uVImHgDwRgiAyD8xwARG/aW9vn5J4IO/EnU7nhOLhcrk6EFMqHmPy7+7utgB5IgRBZAKYwQIivr948eJ1qRAPl8v1wgMPPGDEmRePMXaQiBAEkRHgNAnIVN6J3t/fP6mAYIrEQzdsFVM8Dh8+fNUMiIdALyIS0nAWQRDpCmaggIjPOzo6UuJ5OJ3OdBGPMXb1kidCEEQ6gxkmIKgTj2AwOBfFY4x9veSJEASRrmAGCQiO9Tz6+DnTIh6vvfbaVe7ZE48xdnZ3d++FsIjISCJCEES6gGkoIIODg+MERPy7ubn5+lSIh8vlen4i8XC5XJ2IsyoegiAiYldX1+O8HkhECIJID/DSNNi0FRBMveeRKeIhENue/IrXB4kIQRCzD6a5gOAl8UiJ55GB4iFQEBE7Ozsf43VDIkIQxOyC0ywgQ1MTkCyAsHgEg8FpFY+jR49encbiIQgikogQBJEm4DQLyODgYMICYrPZvo68g0+VeLiczoOR4oG87BkiHgISEWJaSMn7owlitpFl2cgY07q6ut4xf/78vxqNxisAQAUAOcGkFAAwulyu57ds2fLh6urqEAAwxpiGYZELWa3WazZu3Hg4Ly9vqaZpqiRJieYx0xgBQFm6dOm/dnd3A2Psc1xENMYYzrZxROZCC42IOYEkSYNtbW2rrrjiisMmkyll4rFr164x4uH1et+9adOmV/Py8pYCQCaIh8AIAMrixYv/tbOz89eMMRXC03zJEyEIYubAaR7CGhgYSGQIS0VEtNlsvwsEAk38s6nEPA5u3rzZgFGGrbxe77tVVR2ZJI8QhsuWrocPEbGrq+sXuktKIkIQxMyA0yggmzdvNtjt9kQEBFVVRZfLJf6rJWFLWDxGRiYTDwf/fbrHPOKiu7v7zxaLJQ/DZSURIRKGYiBE0mialtL0EBGqqqqSOtfn82FeXh5C4sOyYtjq4La77/5wVVWVumvXLlZZWalZrdbRmIcsyy9IklQA0YfGEACYpmmafWjo275AYNDAmIF/PvaHkqSpqjrrcQdJklSGWJgFUMIYcyMi4x4gQRDE9IH8qby1tTXl27ljeB1Hwh7I0NBQwgaIXXWdTueBKJ6HmLJ7jcvl6uKnxPI8hNejIGLpbF0XgphpKIhOXK4okiQZXA7HwW3bto16HjxgLkmSpL3x2mtrN27ceCQvL28JxBeUZwBQWF1dnWO32/c5HY6XnE7nIUf47wsul+ul5ubmLyCiobGx0czFMqGjtrbWlMx54rBarYbGxkYzAMCf//zn9RaLZS0AAO3cSxDEjICZ74EEERFHRkZGPQ/RgWLYC2GNjY1mj8dTz9OfLOYhPJAQIi7bs2dPjqIoUW3v7uz8rb68iZCKTh4RZQCAAwcOrB4YGOg9ceLE+wEALBZLpswmI9IIioEQlxsKABgdDsfBuyNiHuIHjDGsra01ms3mEk3TEo6rFBcXIyIOa5pWBDw+AgAhADAggCcZoxFRZoyp/f39651O58fXrFnzdUSUGGNxB6JETGffvn1rbr311sNFRUULz50750jGHoIAIAEhLi8UADA6nc4Dd999971VVVUqAIwRD0EoFEJEDMmyzLiIJIrM14gIAUEAkFkSw8ZCPOrr61eWlJT8VZKkU/yruKPeVqvVsGXLltC+ffvWlJeXHy0qKlqmaRoyxoyJ2kMQAhr3JC4XRsXjrrvuulcf85jgnFmfliTEo729/corr7zyiMFgWKAoynAiaQjx+NOf/nTV35eXHy0tLV0G4RgQk2V51meEEZkLeSBE0qR6Gu80IoatDhQVFd2LiOOGrdIRvXgsXLjwqMlkWgkAyCQpbq9BiMezf/rTVeVbtx4pLi5eliHbrxAZAHkgRPJkgIBomhaCDBQPHq8YIx6apgUAgLEo60tipUHiQUwn5IEQcxlFkiSj0+ncz8VDywTx4J5HqLGxsWzRwoVHjGHPI6GOf1Q8nn32qvLy8ljigYhIQ1hE0pAHQsxVwjEPh2N/YWFhpomH2tjYWLZyxYojxrDnkdDGkHrx2Lx589FY4gEAzGAw0EMkkTTUeIi5iIh5ZKLnobY3NpYtWrnyiNFoXAlT8Dw2b958tKSkJNqW8xoASF6vFx0OxxAAwPbt28kTIRKGPBAiXRAznvJUVS2M+CwRMls82tvLFq5YcdRoNCbteVgslqvLY4iHmJLs9Xqhvr7+o//4j/94LtH1JAQhIAEhkmY6ehyXy2WA5D1jMVX3uUwSD13AvIwHzFdAkp6HxWK5+vbbbjtSHMPzkCQJvV4vq6+v/+jGjRstXLjSun6I9IWGsIikUVU15WnyoG7CwymIKDyP54qKirZniniIgLlePBKdKTVGPG6//UhxcXFUz0OSJPB6vay2tvaj73rXuyzV1dVGxpgyPSUjLgdIQIi5gDKvtFR4HhkjHmJrkaamptULFy48MhXPY7/FcvWtMcQDwp4H+Hw+qK+v/8i73vWuvdXV1caNGzeSeBAEMbOIjQAbGhpSuZmiEQCgq6urVFEU8da/eF4OFUREbGlpeRYAZNRtjJhk2RgAQE1NTa6iKD2IiKqqTmbHmM0ULRZLdjAYHI74TkFE7O7s/BXPJwsAoL29vSwYDLbpzp8IBRGxr6/vLzwNMwDA/v37r7bb7Z3c1jFpcNtVj8ejVVdXbwcAqK6upu1LiJRAMRAikwkPWw0PP3fllVdmhOfBwqN0jDHm72hqWr1o0aKjRqNxRZSAecyhPMYYVlRUSIyxwL59+6655ZZbjk7geaDwPDZu3EieB0EQswumhwcitmR/BlLgeejKNq0eSE9Pzx4AgJaWlqsn8Dxi5Sc8kGcAAPbv37/WZrN1cRsj01Ax7Hmo5HkQ0wV5IETSTMdeWE6nE3DyxdEiYP5sUVHRDswAz0OghULDdXV1i5YuXXrEaDSugPEvqtIAgHm93qA/EHADwLj6YIyN7NmzZ/mtt956pKSkZMlEU3Xr6urI8yCmDRIQItMQw1bPZlLAXNO08L0mSdetWrXqFaPRuBSii4fk8/l8DQ0NdxtkuR0AQDfNVgIA8Hm96+66667DxcXFiyaYqgt1dXUfeec737mPxIMgiLQB+RBWXV1dyoew6urqSoPBYKwhrCAiot1uT+mwVUTZpmsICxERXS4XRktTVVUVEdHn8/nOnDlzGwCAoigd4mv9bx0OR9Q0UDds9dZbb90LQMNWxPRCHgiRXrhcsYawFAAwDg8PP1tSUpJRw1Z6AoEAQthL0K+y1yRJkvx+v6+pqWnb+vXrjx48eDAHwh7KOBRFQVVVx6UB4aEv8jyIGYMEhEgaLRSaqazEsNUzJSUlGTNsFQ3GGAPdfaeFA0mS3+/31dfX33XDDTccQUS5t7c3ZsfPwujvXQ0AwOv1YsP58ztIPIiZggSESHeE5/FMUdjzgEwVjyiMeh6NjY3bbrrppiOIaGSMJbLEf9TzOH/+/I4NN9/8DIkHMVOQgBBphQvGzDoaFY+SS+IBc0U8gHsejXV129avX38Uw7GlRNw6IR54/vz5HTeTeBAzDAkIkTSKqk7nFuAaAJjsdrsQD5wr4qEftmqsq9u2fsOGo3xfqrjFAxFHh61IPIjZgvbCIpImKyvLABOsmJ4CCgBIdrt9X2lp6Udmc9gKEUePiX7DGANEBEmSxp0XDnsAMMaAB78lv9/vq6ur27Zhw4ajiGiItalhtDQ0TdNkWRaex/abb775WRIPYjYgD4RImL179yIAAGPsdQi/s8MI4RlDyRxjRGHw4kXNaDTOczgc+7l4zJrnwRgDxhjKsoyMsZiHJEmjf8W54hzxHRcALS8vT/L5fJHiEdXzEPlHpIHZ2dmSx+PRGhoaSDwIgsg8EFECAOjo6PiO3+/3TrJOYiIsPD0jAMC5c+eWtbe3P7EZwICIDPm6jBks1+g6EK/XO6CqKvJpszGPUCiEqqpiMBhE5OtAPB6PS/9dKBTCUCiEA/39IzU1NX/P8xo3AiDy37Nnj9Hr9Xbq8xdpDQ4Oek8cO/YhAFrnQcwuM3pzEnMLDG8KiMePH19x0003lWVlZRlD8U/tRYPBwACghzF2TqSlf5oWn01bASYyDlGqqam5NhgMxtVBmwAAjUbUNK3u+eefV7dt27ZOVlU5yL83Go1oYowdf/NN+4MPPtiB/A2EE+TPTp8+fS1jzBQMBkfTYIyx5uZm57333tuCFovMduxI/UtZCIIgZgLhiaQSHk+Ysw83qaiz6ah3giCIGaeiokJCRDnJI207QkSUEj0mOzeRrVdSkQZBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEAQxFRgiylM4X5utF/5EwrfSTvYdEmlTDoIgCGIGmcsvHyIIgkhXmM/n24KIisEw7vXMk4Hd3d1vr1y5MgAAMFtP8PztdWC3228oLi4uUBQFIX5PBI1Go2Sz2VrmzZvXPZuvUCUIgsg4hoeH38Ik6evr+zEAwBSHwZLGYrHIiMhqamqu8/v9SjJlUBQF62pqruPloDe9EQRBxMuZM2euDwQCPkRUVFVVETGeI4SIIb/f76uuri5DRDYbna8QruHh4Re5HgTjtF/lv9WLYMIuGEEQxGXPwMDAY+KBPJGHd0TEoaGhvwDMvBci8mtubr5d0zTkohYvKiKqXq934OWXXy5BREbvmSYIgkgQRGQnT55c6PP5HLxj1eLpgUWnrSiK1tjYuImnNWMigmGPR3K6XKe4SYkISAgRsbOz88s8LfI+CIIgEkV0nj09Pd/hnWsiXkgIEdHhcByDqU8JTsRm4X18IgnxUBFR87jdzQcPHsxBRAlpFhdBEETiII9f7N+/P9/tdndi2ANRExWRpqamD/L0plVEhL1//cMfcj0eT1uy9nZ0dHxsJuwlCIKY04hOtKur6z59J5tAh6y5Xa56i8Viwqkt6IvHVgMAQHdn57eStBWdTmc1AEhIs64IgiCmDiJKFotFdjqdpzH8VJ9wx9zd3f0Fnta0PNVXVFRIiMhqT55c6Pf7RxBRVVU1rpiNsFNVVWy+cOH26bSTIAjiskJ0ps2Njf+gF4U4URFR8/l8/ceOHSvGaYorCBuHBgZ+zfNNOF5jt9tf1qdFEARBpIDRDnpo6KUkRCSEiDgwMDAtiwvFosGzZ89e4w8EApj4jDE1GAyqp0+ffgciMovFQgJCEASRKiwWi8wYgzNnzlwfDAZDiKjyzjeufhoRVb/f77FarSsxxYsLhSDZbLYDesGKEwUR0Waz/V6fFkEQBJFCdB31bxERVVWNu6MWvx0aGvqjPq1U2dTY2Lg5vFg+IfHQEFENBAKempqaVThLq+YJgiDmPMjjF6dPn17i9/udmMTiwmAwqJ07d+6dfKPDKYsI7/CZ0+l8k2eVsPfR39//7zwt8j4IgiCmC+RTZXt7e3fpO+E4CS8uHBmx8rSm1GGL8zs6Oj6WqHjwGVqaz+cbOnz4cCnSokGCIIjpBcXiwscfz3e73V2Y5GK9lpaWu3h6SYmIsMNisWS7XK7mJOxQEBG7urp28vRoyxKCIIjpxmq1GgAAOjo6PqMXhXjgu/pqHo+nbiqLC3U2PJyoDciH3twuV8uTTz6ZheR9EARBzBgMESWr1WpwO53nMMnFhe2trf8CcEkM4gW593H8+PErfD6fHZNYNIiI2Nzc/HGeHsU+CIIgZgrR6V68ePFOfaccJyoial6vt/fw4cOFmKAHIPIe6Ov7BU8v4TiMy+U6xdePTOv2KgRBEEQUREfuGB5+JQkRURARe3t7f6hPazL0iwaDwWBCiwaFjZqmYUtLy9ZE8iUIgiBSiFhceL6m5kZFUZJaXBjw+91vv/32CoxzDYbo8O12+3NCEBIRD0TEkZGRw/q0CIIgiFlAdMIDAwNP8k464eEkm832lD6tyfKqra39O0VRNOTeRDyILUsURVHPnj27AePcsgTDwmaIdSQav5ko/VSlE+uIcZ48wTlTWlQ5Udqp2i6Gl1uKkZc81TKkE/Fc42k84hrm5ddiKvnI8eaVgrqc87tuT3J/T+sRr4ESIrJXX311WSAQcGOS+1DV1NTcCBD2aibKCwDYyMjI6zyJWV8Jz9OiGMoMw4cy42qkfNHqlAWRiE2qO/5Up0fMPPHenBoiyps3b+7s7+/ffcUVV3wLAELxnM8YA03T0Gg0SsuXLfsJAPzD9u3bMdpvrVargTEWamlp2VFYWPhuAFABIF4RQEmSWDAY9F28ePG7vGFGzUdQUVEhVVZWaufOnStbu3bt5yRJUkEXbNc0DSVJYm63u5sx9jPeScVpziXRef311+dv2rTpax6Px1lQUPDDyeyKlg5jDA8dOlRw2223fdNkMhl5GsJW1DSN+f3+4IsvvviDHTt2+Pg5AADY19f3FZPJtFjTNP05miRJkt/vP7F48eJnEVFijGkJ2CQxxrShoaH7JElaCwCapmmi89YkSZJGRkbevPLKK/cmmrbFYpG3b9+uMcZU/pHh7bffXrNgwYKynJycZb29vSaz0QgFRUVeh8PRYbPZGjdt2tTKGAsJ2wDC7TaB8jDGGPb19e0tKSlZq4ZCKMky49+pkiTJjY2Nj1133XW/QkRZZ1tKEHV0/vz5G9euXfsxANAAYKbEUOT1e8ZYbeT14u2YiTLXnjq19opFizaBLK8pKChYIMuyebL7QpZlCAQCI263uz8YDJ6uff3144wxO0D4eu/YsSNl9cmvP548eXLJjTfe+HtN02xf+tKXPr5nz54QhAuS0P0XKw/GmHbgwIFVmzdvfiE7Oxs0TQNJkkDTNJBlGVVVZa8dOfKRrdu21aa6jHob+np6PrFg0aL1MLNtJjGQu4OHDx8u9Pl8PZjYor4QIuLg4OATPK1xoiDSf/LJJ7M8bvfFBNPX5/GfsfKIkSc7fPhwodvtHp4o8YsXL8Y9JKZLX7wu+Eej6TQ0vJ/nm3A6XV1dn5/IxpGRkSP8nSmyKB8AQCAQaJngnD/o80jAJpGHNVba/X19f04kbYyIkV24cOEWh8Pxc7fbfcHv98dsC36/3+/xeE7Z7fYfnTt3bn2EjfEOyzAAALvdXhsrn9raWjEZJOULUsUwaX19/X2x8p8BdujqbUy9AABcvHDhTofDcTQQCCQSk4yK3+/v6+3t/emBAwcWROY5VURag4OD/y3y6+jo+Gwq80HeTp999tlrJyrnC/v3vwtg4lGXKdggAwD09fa+ONXrkSxJGdzZ2fkgP3/ShsTXbqh+v3/kyJEjC/hT/DiVxEud7c54046Sh+3Ua6/NR0SpoqIiLiXGsZ2ziog+DMd4xOFDRHVoaOh/9HUQR7oMEdmhQ4cKfD5fPyIGETGkC+7H/aSAiGzPnj1Gl8t1AREVVVUDwj5VVRVEDCjBoFJfX79BbyPym9/v91dHnifK6XA4fqWvhwRsEnk8x9PzR6Y92N//m3jT1tdHU1PTVrfbXRXlUociro2CEQ8ZgUAg5HK59ovhUt7eJhUR8RubzfZmuEmpIm0VEQOIqNbW1lYkU1fxIASkrq7un/R1OEOHuHZ38/KNth/GGHz605/OGhwcfDLiWkwlv9F72+v1dra2tr5fn+9UEDM46+vrrw8Ggwry+87n83UfOnSoAFO0oFi013379l3j8XhU3mb0f0OhUEg9dPDgO4VdU80zig3iTbL/MwttRkFEJVGbGYY7Z4Mz/sWFIUTE3t7eR3ihx918yJ88Dx48OM/r9dow8UWDYrrw12PlMcFFYIjIXn755RK/3z+EiFpE3hoian6/33/69Om4t6kXNnR3d39BZ2MyAX4ZAKC1tfUefX1G1q/L4XiV/17SnSsE5DTi6A4BY+rM4XD8OtE609uFiAej2BXewLKvT3icE6Yt0rJYLCXDw8O/i6h70ZFP1B40XrbRyR2BQCDY09Pz/4APs052zfCSgFTHqqvz58/vSqau4kHngXxMn+cMIa7dB8X1QN7Od+7cmTs4OPia7ndxT2qZBHFtUVEU7Onp+bC+LSSLON8+NPQi4mhcNISI2NXVVaGv6ynmMyogXq83XCBeL/yvpqoqzoSAdHd3/4XX6Uy2GURMPOCIAMAqKytDg4ODj8DkwwMaAEgej6f1rbfe2s3zizYOKDHGtHdu2PCt7OzsEgiPocf7lKABgOz1etsPHjz4ywnyiAofD5XvuOMOu9Pp/B0AMB4LGf0JAKhms9m8ePHiL/Dfx1Nv6p49e4yFhYUPAQDw+IBmMBikJYsXf5kxhtu3b4/HRAQAKCoq+tpEPxq02X6qszdjQB5PaGhouOHOO+88UVRU9GkIXz8RjzJAuL4nKheTJEkCAAOGvWrVZDIZFi1a9MjI8PDRZ5555goex0vP8eH0gwG/Jx955JE/zps37xYACEI4Hinz2Foq8jAAgGowGLC4uPipurq66yRJUpO9Trq2dFtRScmdAKBKkiSLe6+0tHTn66+/vqS8vDzpPIixJFyJjDEVEeWysrIXHA5HFYQbVawOGwGADQ4Ofvuuu+7yhk8fG8DiF1J7++23VxeXln4OuCAkYBICABsaGvregw8+6K2qqpKSCJJpiMj6+voeUxQlwPMfTUPTNBkAMD8//76zx44VA4CKE7jBfDIA3n777Xfl5uZeBeGGLIl08/LzP3zixImVPN+Y1wDDTxhYX1//nvz8/PdARN1omqYBgOR2u+u+8Y1vvIjhIYeUBuqmE77GSH3zzTdvXLFixVFeVwrwjirKKcjLLARGg4gJCbxzE+cqhUVFt/79li3HLBbL8kwQEQwroDpLh6hLmTGmdnR0/J/S0tIPQviamCJt5ZMyEsqDn6NHBgA1Kysre/myZXt0EzGSAQGALV606Md6keMPo1pWVlb+mrKy/8v7h4x60JoE/T0xo0dSF2vv3r0AANDZ2fn1kKIghIe2In+mAoDscrneXLVq1V8w9swVxhjD5cuX/8hsNpth7OyiyVABQHI6nTUnT558GhGlLVu2hBItD59xIt1www0tbrd7P89/1FbeANXs7OySeWVl/yy8lljplZeXawAA8+bN+0pkVhB+Os5etWrV5+LxZhhjuGDBgq/JsgwQbiijSJKEAMDsdvvP9+7dm8iMtVkHEaUdO3aoZ86cufqGG254JSsra56maSoAGKP8fNQj0QmxDJc8kxBE1A3/3KhpWqiouPiqrVu3Pn/o0KECnnc6dx4mCJfNDJfKOd2HyFPUvWK1WrPmz59fAbEf6FR+XySUlyRJLIqIGABAzc3Le09TU9NtYtZnIpXG+xetp7PzgfyCgptg/AxOGQDUwuLiT/GJFtpcea01YywXZr7NyAAgJzUWuGPHDpVfsLeGhob+p7S09OMMUQXGxlwQVVWht7f3YYjRCBFRliRJbWhoeG9xcfGHIbFpu+E0ANjAwMA3hU3JlEdnDzt79uzP8vPzP2IwGCI7dgnCXshDhw4degzCLv24qcLcBq2hoeG9ubm574XxXoMsSRIWFRX987Fjx34EACPcc4jqmZ09e/aavLy8D0DYWzHonqw0AJB8Pl9vS0vL07xTzAjvg9vKLD/9afbKlSv3mc3meQAQkiQpsj0iP2QAAL/f71FVtVlVVQcigsFgmG8wGK40m83i6Vi0y9EEeJpKQUHBDZs2bfo9Y+wefo3Sqq4GBwcRAMDv93ePjIy8huG4z0x1cJokSRIi9vO2qHV1dd2elZW1HKLfkxoAyD6vty8QDDaFNX3SqekMEdFoNF6Xk5NTAuMfFBEAsKio6OMAcBgS9xDCrqfJtEaX3rjvjUajYfny5Y8yxu6I8tCbaSAAgMvlOpWdnV2ImqbiDD5ETnUFsoSI7MSJEysDgYAHxwY6xerzffy3UQslhhNGRkaO68+LE7Flyf9OlEeiZQIAGB4ePobRJwiEEBFbW1s/ChA9GCfsGLHbn+HnRAtsKYiI3d3dX+LnxExnaGjolzHSERMHKidIIy2D6OLc/v7+f+e/D0apo1Fb3W7331paWj5ptVqXRpghvf3226v7+vq+5PF46vjPNYwecA8iIra0tHxab0NkXc1WED1dEGWzhdvdaKA78rrYbLYnnn7sseJE0z/6wgsr3C7XeX499LMCA4ioeDyecxXh+EuidjNEZC+88EKxz+cbwPGTYQQhTdPwwoULt/Pzkuo3MA2C6BkPjl/noOCld5D7T506tQZjzFoSF66lpWW7uLBRLnZUxKtzFUVRGxoaUvbqXCEIFy9e/FAMm0KIqDkcjjeBz0iLKJOEiOzMm29ezTeB1GLMWAm/q8Ttbtq9e7cZ+RO5SIev5WBWq3Wh3+934PhOUcwMc1VXVy/idTzujsM0FBBRR1ar9ZpAICCmdEZWkoqI6PP5RlpaWj6lz1dMA4+s+4qKiqyBgYHvBgIBUVfR0lS9Xm/fsWPHiiPrDNNEQFC3/cYsHKNt2uVyvRp5XUWdeL3eszp75QTSNwEAtLS0fARjoCgKHj9+/Ar9NYkXcf92dnZ+MdJ2HSFERKfTeWr79u0yzgEBmc02kxLDn3vuuSK+1kFD/qTX39v7M/6baENXo28a9LjdzXhpGmZciC1L7ENDf4qVR5IwRGQVFRUml8vVGMMuFTUNm5qayiPzxsm9Bj3irY07AMZ6M3hJmL8dIx0FEXFwcPC/Jyo/xicg/4X85sbEGo+R/31eXx592jEERAYAGBgY+EOMsqmIiMFgsK+xsfFGfo5ktVqj7dXEuNiODu3V19d/2O/3x5r6K7y2b0axK50ERObrGWbiYJH5AwAMDQ2djlUPvb293xdtINGyVVRUSMeOHSvu7e39fH9v7+fF3/7+/s/19/d/vqen50Gr1ZqXYLqiIxPLDExut7sBY/crYiThn/n5CfcfIs80ERBpJtuMPu8p3QiMMbRarfI999wz0t3d/f3Fixf/AgCY3++31zU0/IA3xmjbSUh8lscXcnJzr4To498x64tvWRJoaWv7DsaxZUkCIAAYKisrg5/97Gd/mZeXt5tP6R1VWr69CZSUlOwEgCrxOV+4qB0/fvyKvLy8T4Bu7H6i/Higfa8IvPPyqH/9619zi4uLH+Tp6Nd2AGNMVhRFHRgY+BkiMjGpIUkUPokgmOB5wt64Jy1UVFRIjDH1jTfeWFpYWLgdxtcRAgAqiuK/cOHCtuuvv/40IhoZYwpEb0dYWVmJlZWVGq83I2Psmba2tvuWL1/+FJ+0oY8/SZIkYX5+/gO7d+/+T4gRx5pNeCxs1uMzBoMhZp2YzeZ5PNBtjHfBLkdcr2EA+NXUrQzDbRFxRKmysjL4yU9+8pGysrJnJUmK1m4YAOD8+fO/b7Va9wGAV3d+xpHIlj2pZspPUmJO9a5du37z8MMPP5ibm3vd4ODgri1btgxZrVZD5Kwo3uDwxIkTC+bPn/8tCM9GlXkgLh5UADCM2O2/3rhxYzOmfl8iFRHZiy+++FRpaen3xLoU4J04C08UwIKCgjtOnz69DgDq+NOIxBgL9fX1fdZsNhfC5HuFyQCg5eXlbWppabmFMfYaV3fGGAt1dHTsyMrKWgYRQUy+35PB7Xa/vG7duvOImOweO+GgoyxfgYjrYOLp2LHsVwGgSJ/eROzatUuqrKzUli9ffpfJZMqC8XWkAYDc19f3yPXXX/+WTjwmhd/8QX7OH/v6+v5hwYIFnwJd/fEZXFpOTs6q973vfe9mjFVNQ/tJCtGB9fX1LTCbzetOnjyJ2dnZzGwwgMFsBoPBAAZD6hwfGRGZ0cgMBkPt6tWrB/QdMACosiz3AsCNMFZcZQDAnJycHdXV1T9ijHUkkmdlZSUAjHpwMdub2NMsHqxWq6GwsHALY+wwY2x0mQFj7Dm73V5VXFxcDuMnAkgAoObm5i699tprv8IY+z63KeEZnLOJuGY2m+264eHhKy5evIj5+flMluXR9pKqNiPLMjJVZSpjytq1a0+IazTl1BljiIhSZWVl8DOf+cyPQqHQD5944olfY4wFfbt27WKMMXVoYOB7WVlZRZCA98Gf/iWfz2evOXv2R4jIdu3aldKnBl4ewwc+8IHhgYGBJ7Kzs7/OyyEEBCC8+MmwbNmyLzPG7ucdv3rw4MGc/Pz8f4EIr2GS8kBhYeHDAPCa+Hj79u1yUVHRlyG87oFFiKsEAOCw2f59ikWVAQByc3N3AMCOKaYFEN+kDAQAyDab3w/jn/o1AJD9fn/HG2+8IRaEJnNDq4jInn/++e9u3br1XpPJlA1jZ/xojDFWWlr6fgh7kGkxpbeqqkoGgJDD4dh61VVX/X7r1q0zkq/D4fgEADwN4fYQAl4fbre7Oi8v704+VVzAAEAzm80l115zzdHW1tbvXrhwofrcuXNqnsGA/hh5GI1GzMrKghtvvFHZsGHDAO98Qnhpk8aEn6CF8C9btuzWRYsWHaypqVm7fv36NmE/Ywy6uroezsvLO2k0GoXnPno+90a14uLir7399ttPAEAvYmKbfqYBEgCooWDwB2VlZXdfeeWVY8o4HQQCAbWvr28xAAxEDn9OFfbkk09mvfLKK2sAogfA+FgdO3Xq1Npk3zSIiNjX1/ctnt60jEULO48fP74iEAh4MXYQ2/36668vEWVtb2//Z72dEYwrqxgrVRRFqa2tXSsufkN4w0VxTmT5NafTGTWIH6UcE8VAppOYMRCLxWLyeDyt/HfRxtenvGEh8nHa4eHhA/q0OSFERIfDcURca16XabGVCd8La3T/rWk8ghieVCA2UDQAXBqrP3PmzE2hUCjWhqaj7djr9SoOhyPodDpjHi6XK+B2uwOBQMDt9Xov2Gy2py5evPj+yOuVCPwcSczgHBoYeFqflvg7NDDwR/11jyDcTvv7/ytROzANYiDC3r6enj/PQJsJYfi2GOnt7R2d5JDKVbl43333+d/3vvc1AcTcMpkxxnDFihX/ZjQaTTB+LvhEaAAgeb3ezldeeWWibVGmjFhY+N73vrfd4/E8BxELC8X/zWZzbllZ2QOMMdyzZ4+xpKTkSxB7PH3cdhx6b2bB/PlfRj4vfeHChV+FS2sgxpk3MjLyHwCAVVVVab2qWo8YK1+3bt0ig8GwmH+srw8JAMDtdh/Gqce1GCIyv9//SrTvAAAMBsOqPXv2GPn4+RSySi0s3CikmTpUVR3TJvl6Kmn9+vWn3G73qwAg8QWeY8wEvvo5OzvbUFBQYMzPz4955OXlmXJzc00mkyk3Ozv7qpKSkk+UlZUdcjgcr54+ffpmPuyUyP51MmNMbW5u/mhhYeF7AEApLC7+p7q6uk18KxQ5/DNkTc3N3wkGAh6IHuuSAUArKir6P3w4OlMXF85Ym8GIh9ZUd0AsVlBNXPQLFy7cXlJSsg0SXzSIAMBsNlvFpz71KU+SW5bEzd69ewERWXd3989CodC4ISnd9ib/CgDS7bffXp6Xl/cOGL9oUgMAdLlcjT6fb5B3VuPGlQsKCz/2t7/9Lb+mpua63Nzc2yAiwCy2LfF4PM21tbXPISLbsmXLrI/dx8u6desYAIAkSfOiPDwgAEh+vz84PDzczK/rVIYSkDGGgUCgnv9fPwlC5Fk4PDycM4U85ix79+5liMja29t3Koqi8XdcRN5ro1vzJHhoXJDUgoKCW6+55ppjHa2tH2OMheLZ5FA8XLz++uvZCxYs+AGEh3nBYDCwxYsX/1g8DIiHwHe/+91ttqGhX3B7owkhmkwm48oVKx5NYH86gpNqAcHKysqYsx4AQFq0cOGjiSYqOk+Xy3X2iSeeeArDW5ZMa+fJA9Ps+uuvf8vr9b4K0bc30bKzs+dfuHDhE/PmzfsM8MYcAQIAa29v/6LX631CeB2678Pbm5jNuUuWLLl/yZIl9xsMhnGz1/hsEjY8PPyrO++8c9x+XVMBEZM+EqWhoQFEHUWej4gB/9BQrKH0hCkpKRkXQxHxpJycHO0b3/hG+rgeaQRv+9L69etPDQ4OfgXCW5CoWpTGDeH2m8ghSZIkA4CsaZqalZVlXLR06dPt7e3bt2zZEprMA6iqqpIZY9qqVaseys3NXQXhVfRGAFALCwtvaWtru5cxpnIx0hBRGrLbfxwIBAaAexwRScoAoBYUFv5jQ0PDbSIIn1TFXYbMyBCI1WqVGWNaa2vrp2PsUzMhYs+ngYGBRyorK0WgbyZufgYAMGKz/SdcugHGmAYAuGTJkp9nZ2d/EMJ7NUV6H5LH42m7/vrrXxkcHPydoighGN/5yxCeVrgrLy/vfoCx4+z86U/2+/228+fP/x5TvG0JYwyTPRLNa/ny5ZGTAvR2yGp2dspuXrE9iB7RB/r9fuk3v/lNWgTQEyTRJ/7JjqiIYaUlS5b8vK+v7xsAYOCz2EIwduPFpOE75aLBYMAFCxb8rrq6umz79u0xN7ysqKiQysvLtRMnTiwoLi7+Jujegsk9S5w/f/6PDh06ZC4vL1cZY1BVVSXdcMMNwzab7fswQb8hSRIsXrz4x8Dv6amWLc2YtvYy7QKCiKy8vFzbv39//vz5878PicU9ALjYDA8PW1evXn0IZ3DaJb+J2MuHD7/k9XrrITwerH+CYQDAcnNzC41GozlKEhoAMKfT+XMAwGuvvfaCx+N5CaLHVFhubm5+VlZWNs979Evxql2Xw/HbO+64ww7h3VJT0sg1TYNQKMRUVU38CIWibaIZFfEa4+zsbGcoFArB2J2ZxVBCzrKFC5cCAOzduzfptllVVcUQkZlMphX8o3FGqqrqM5lMgWTzmEUSfeKPdRhgkvuQMRZCRHnRokU/bmtr+5DH47nIz5PhUmesJXCEIOJacFFSzWZzzurVq3/KJtgpl8/g1FatWPFts9lcDLrXPuimaK9+xzve8QUxO3TLli0qIkrHjx//jcfjaYDx9zDw8qj5+fk3tbe3f4LHxebSdjWpaC9isknqFhLGicQYU3t6er6am5u7BBKPfbBQKKQNDg5+c7qnqMVAfvDBB5Vt27b9Micn51cR0xoFiJfeQQ4Ao1N0Zb/fbz979uzv+fc4MjLyH4WFhdsYizqBQd+h6j+TFUXxtbS1/RpjL85MFBUAZLvdvu/UqVM/LCwslH0+X9zCbDAY5JDXq76nvHy3yWS6VePzIic4BQEAamtre1asWDFsNBrni3dIC3skSTJkFxT8HQBUb9++PemLXV5ejowxHBwc3KLPG2B0KFDWNK3zvvvu84vrlk6B9CiITtWuKMo2RPTCFL1wRVEgNzcX8vLyWvhHsdZkjK6rqKioOHz//fd/Kj8//5/MZvMNZrO5ABJ7GBQXe4xIYHgnAS03N/cDJ06cuJYxVo847r3sEgBoNTU1VxWXlj4AUTZo5VPetby8vK889NBDv4TwQlEEAGnHjh3BlpaWb65atWr/RIsLS0tLKw8ePLgPAETbSOuGMQEqhNv5X0Oh0DdDoZBsMBhS8eAdWrhwoQ0gPHIxrQLCG4H6t7/9bXFxcfFOSPyl7yEAMLhcrr1XX331mzPpfehQEZG99NJLfywpLq4wZ2XN5+Kgv3FYpLhxr8Hgcrl+e8cdd9gR0YCIGmPsVafTWZ2fn78BxotptJtRpPPspk2bWlNYBwgAYDab+7Zu3VqTdCKIdoDRYcaYiCdCxph7eHi4IScnZ77ozMVPAADy8/M/AQC7IcnOUQRZH3/88fzc3NwPAIzugDz6EwDAUCgk9nMas/4hzVGMRuMb07FWYaKOUici7srKyscA4DGr1bqwrKxseU9Pj9nv90+4YE1VVVZaWmqYN2/epqKiop1ms7kEdCLC7x3NYDAYVq1Y8SEA+CGE+4kx3j5jTLPZbP9mMpnMoFubJeBtUA4EAs/+4he/CP785z+XAEDV2X9gZGTk1cLCws0Qe3Hhyg0bNnyRMfZvPI6SUYsLdSAAgCRJg2azuWa6MpluD4QhIhsZGflJVlZWPkS56BOAACApihJsampK9ZYlcSMWFt55553Onp6e3y5atOibkiRNtsocAUAOBoOBtrFegwQAIfvg4M/y8/P/GKcJUigU0rq7u1Oxbcl4Q/meVhAuTyI3i1hJnEgbkgBAC4VCVgC4BcbHgdT8/PwN7e3tdzHGDvAn00RvYANjTOnt7f1cdnb2FRD2bCJFmnk8niMAAFVVVQkmP6swAMhDRDekLg4YNZZlsVjkyBlJiGhoamqS16xZozDG+gCgL8G8/vf8+fMvrV69+pjJZMoBnYiIBbM5eXnvEtnp8hUzOG8pLCy8R9M0jTE2Ztt+8VDn9/vttbW14qVRY4SWMQZdra1fz1m37o2JFheWlpZ+4+TJk7+7+eabByoqKqQYE4MyBXF/p+wVBvoHmP8PPCPq00WjPeUAAAAASUVORK5CYII=';

const sb = supabase.createClient(MKT_SB_URL, MKT_SB_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'vw-marketing-auth',
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
let mktProfile = null;
let mktAccess = { level: 'none', extra_pages: [] };

// Page bundles per level. Deliberately small at the bottom: an inbox agent
// should see an inbox, not a marketing suite.
const MKT_LEVEL_PAGES = {
  none:      [],
  inbox:     ['inbox'],
  creator:   ['command','content','poster','gif','calendar','greetings','brand','brand-profile','inbox'],
  publisher: ['command','cmo','content','poster','gif','calendar','greetings','approvals','social','gbp','whatsapp',
              'brand','brand-profile','inbox','email','web-push','reviews'],
  ads:       ['command','ads','analytics','segments'],
  analyst:   ['command','analytics','reviews','competitors','segments','audit'],
  manager:   ['command','cmo','campaigns','poster','gif','content','calendar','approvals','greetings','social','gbp',
              'whatsapp','ads','local-seo','website-seo','reviews','analytics','competitors','segments',
              'agents','brand-profile','brand','inbox','email','web-push'],
  admin:     null, // null = everything
};

const MKT_LEVEL_LABELS = {
  none:'No access', inbox:'Inbox agent', creator:'Content creator', publisher:'Publisher',
  ads:'Ads manager', analyst:'Analyst (read-only)', manager:'Marketing manager', admin:'Admin (full)',
};

function mktCan(page) {
  // Failsafe: an admin must never be locked out by a state bug, a stale cached
  // build, or a half-applied migration. profiles.role is the source of truth.
  if (mktProfile && mktProfile.role === 'admin') {
    if (mktAccess.level !== 'admin') {
      mktAccess = { level: 'admin', can_publish: true, can_broadcast: true,
                    can_spend: true, can_manage_keys: true, extra_pages: [] };
    }
    return true;
  }
  if (mktAccess.level === 'admin') return true;
  const base = MKT_LEVEL_PAGES[mktAccess.level] || [];
  return base.indexOf(page) >= 0 || (mktAccess.extra_pages || []).indexOf(page) >= 0;
}
function mktCanPublish()   { return mktAccess.level === 'admin' || !!mktAccess.can_publish; }
function mktCanBroadcast() { return mktAccess.level === 'admin' || !!mktAccess.can_broadcast; }
function mktCanSpend()     { return mktAccess.level === 'admin' || !!mktAccess.can_spend; }
function mktCanKeys()      { return mktAccess.level === 'admin' || !!mktAccess.can_manage_keys; }

// Hide nav the user cannot use, and land them somewhere they can.
function mktApplyAccess() {
  document.querySelectorAll('.mkt-nav-item[data-page]').forEach(function (b) {
    if (!mktCan(b.dataset.page)) b.style.display = 'none';
  });
  document.querySelectorAll('.mkt-nav-section').forEach(function (sec) {
    let n = sec.nextElementSibling, any = false;
    while (n && !n.classList.contains('mkt-nav-section')) {
      if (n.classList && n.classList.contains('mkt-nav-item') && n.style.display !== 'none') any = true;
      n = n.nextElementSibling;
    }
    if (!any) sec.style.display = 'none';
  });
  const badge = document.getElementById('mkt-user-role');
  if (badge) badge.textContent = MKT_LEVEL_LABELS[mktAccess.level] || mktAccess.level;
}
let aiPaused = false;

// ── AUTH ──
async function mktLogin() {
  const phone = (document.getElementById('mkt-phone').value || '').trim();
  const pin   = (document.getElementById('mkt-pin').value   || '').trim();
  const errEl = document.getElementById('mkt-login-err');
  const btn   = document.getElementById('mkt-login-btn');
  errEl.style.display = 'none';

  if (phone.length < 10) { showErr('Enter valid 10-digit phone number'); return; }
  if (pin.length < 4)    { showErr('Enter your PIN'); return; }

  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

  function showErr(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
    if (btn) { btn.textContent = 'Sign In to Marketing →'; btn.disabled = false; }
  }

  try {
    const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
      email: phone + '@vwholesale.app',
      password: pin
    });
    if (authErr) { showErr('Wrong phone or PIN: ' + authErr.message); return; }

    const uid = auth?.user?.id;
    if (!uid) { showErr('No user returned — try again'); return; }

    const profRes = await sb.from('profiles').select('*').eq('id', uid).single().then(r=>r, ()=>({data:null,error:'not found'}));
    const profile = profRes?.data;

    if (!profile) {
      showErr('Profile not found for this login. Sign in to the Staff Portal first. '
        + '(uid ' + String(uid).slice(0, 8) + ')');
      return;
    }

    // Access reuses the staff portal's permission system (profiles.permissions),
    // which already has a 'marketing' key and an admin UI. An earlier version of
    // this used a separate marketing_access table — that was duplication and is gone.
    const perms = Array.isArray(profile.permissions) ? profile.permissions : [];
    const isAdmin = profile.role === 'admin';
    const hasMarketing = isAdmin || perms.indexOf('marketing') >= 0;

    if (!hasMarketing) {
      await sb.auth.signOut();
      // Say WHY, not just no — otherwise diagnosing a lockout means reading source.
      showErr('No marketing access for ' + (profile.name || 'this user')
        + '. Role: "' + (profile.role || 'none') + '", status: "' + (profile.status || '?') + '"'
        + ', permissions: [' + perms.join(', ') + ']. '
        + 'An admin can grant "Marketing" in Staff Portal -> Settings -> Permissions.');
      return;
    }

    // Admins get keys and spend. Everyone else gets the work, not the credentials.
    mktAccess = isAdmin
      ? { level: 'admin', can_publish: true, can_broadcast: true, can_spend: true, can_manage_keys: true, extra_pages: [] }
      : { level: 'manager', can_publish: true, can_broadcast: false, can_spend: false, can_manage_keys: false, extra_pages: [] };

    mktProfile = profile;
    showMktApp();

  } catch(e) {
    showErr('Error: ' + (e.message || String(e)));
  }
}
window.mktLogin = mktLogin;
window._mktLoginReady = mktLogin; // signals stub that real function is ready


function showMktApp() {
  loadMusicTracks(); // load music library from DB
  document.getElementById('mkt-login').style.display = 'none';
  document.getElementById('mkt-layout').style.display = 'flex';
  // Repair access BEFORE painting the label — otherwise an admin whose
  // mktAccess was still at its default reads "No access" while having full access.
  if (mktProfile && mktProfile.role === 'admin' && mktAccess.level !== 'admin') {
    mktAccess = { level: 'admin', can_publish: true, can_broadcast: true,
                  can_spend: true, can_manage_keys: true, extra_pages: [] };
  }
  mktApplyAccess();
  const infoEl = document.getElementById('mkt-user-info');
  if (infoEl) infoEl.textContent = (mktProfile?.name||'') + ' · ' + (MKT_LEVEL_LABELS[mktAccess.level] || mktAccess.level);
  startClock();
  loadAIPauseStatus();


  // Handle OAuth callbacks
  const _urlCheck = new URLSearchParams(window.location.search);
  if (_urlCheck.get('gbp') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => showMktToast('✅ Google Business Profile connected!'), 500);
    mktNav('gbp'); return;
  }
  if (window._metaOAuthCode) {
    const code = window._metaOAuthCode;
    window._metaOAuthCode = null;
    setTimeout(() => handleMetaOAuth(code), 500);
    mktNav('integrations'); return;
  }
  if (window._metaOAuthError) {
    setTimeout(() => showMktToast('❌ Meta connection failed: ' + window._metaOAuthError), 500);
    window._metaOAuthError = null;
  }
  mktNav('command');
  // Auto-run trend scout if scheduled
  setTimeout(checkAndRunTrendScout, 3000);
  // Auto-sync Instagram ID silently on every load
  setTimeout(autoSyncInstagramId, 5000);
  // Check Meta token expiry and auto-refresh if needed
  setTimeout(checkAndRefreshMetaToken, 8000);
}

function startClock() {
  const el = document.getElementById('mkt-time');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true});
  };
  tick();
  setInterval(tick, 30000);
}

async function mktSignOut() {
  await sb.auth.signOut();
  window.location.reload();
}


// ── NAVIGATION ──
const PAGE_TITLES = {
  command: 'Command Centre', cmo: 'AI CMO', bi: 'Business Intelligence', campaigns: 'Campaigns',
  content: 'Content Studio', calendar: 'Content Calendar', approvals: 'Approvals',
  poster: 'Poster Studio', gif: 'GIF Studio',
  social: 'Social Media', gbp: 'Google Business Profile', whatsapp: 'WhatsApp',
  ads: 'Advertising', 'local-seo': 'Local SEO', 'website-seo': 'Website SEO',
  reviews: 'Reviews & Reputation', analytics: 'Analytics', competitors: 'Competitor Intelligence',
  segments: 'Customer Segments', greetings: 'Greetings Engine', agents: 'AI Agents', brand: 'Brand Knowledge',
  integrations: 'Integrations', audit: 'Audit Logs', settings: 'Settings'
};

function mktNav(page) {
  document.querySelectorAll('.mkt-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (!mktCan(page)) {
    setContent('<div style="text-align:center;padding:60px 20px">'
      + '<div style="font-size:34px;margin-bottom:10px">\uD83D\uDD12</div>'
      + '<div style="font-size:15px;font-weight:700;margin-bottom:6px">No access to this page</div>'
      + '<div style="font-size:12px;color:var(--text3)">Your level: <b>'
      + (MKT_LEVEL_LABELS[mktAccess.level] || mktAccess.level) + '</b><br>Ask an admin if you need this.</div></div>');
    document.getElementById('mkt-page-title').textContent = 'Restricted';
    return;
  }
  document.getElementById('mkt-page-title').textContent = PAGE_TITLES[page] || page;
  const renderers = {
    poster: window.renderPosterStudio, gif: window.renderGifStudio, command: renderCommandCentre, cmo: renderAICMO,
    campaigns: renderCampaigns, content: renderContentStudio, calendar: renderCalendar,
    approvals: renderApprovals, social: renderSocial, gbp: renderGBP, whatsapp: renderWhatsApp,
    ads: renderAds, 'local-seo': renderLocalSEO, 'website-seo': renderWebsiteSEO,
    reviews: renderReviews, analytics: renderAnalytics, competitors: renderCompetitors,
    segments: renderSegments, greetings: renderGreetings, agents: renderAgents,
    'brand-profile': renderBrandProfile, brand: renderBrand,
    integrations: renderIntegrations, audit: renderAudit, settings: renderSettings,
    'web-push': renderWebPush, 'email': renderEmail
  };
  // Pages defined in separate JS files — looked up at call time
  const externalRenderers = { inbox: 'renderInbox', bi: 'renderBI' };
  if (externalRenderers[page]) {
    const fn = window[externalRenderers[page]];
    if (typeof fn === 'function') { fn(); return; }
  }
  if (renderers[page]) renderers[page]();
  else renderComingSoon(PAGE_TITLES[page] || page);
}

function setContent(html) { document.getElementById('mkt-content').innerHTML = html; }


// Stacked sticky notifications for errors and success (separate from progress toasts)
function showMktNotif(msg) {
  let container = document.getElementById('mkt-notif-stack');
  if (!container) {
    container = document.createElement('div');
    container.id = 'mkt-notif-stack';
    container.style.cssText = 'position:fixed;bottom:24px;right:20px;z-index:9999;display:flex;flex-direction:column-reverse;gap:8px;max-width:360px';
    document.body.appendChild(container);
  }
  const isError = msg.startsWith('❌') || msg.startsWith('⚠️');
  const isDone  = msg.startsWith('✅');
  const bg = isError ? '#7f1d1d' : isDone ? '#14532d' : '#1e293b';
  const border = isError ? '#ef4444' : isDone ? '#22c55e' : '#475569';
  const notif = document.createElement('div');
  notif.style.cssText = 'background:' + bg + ';color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;display:flex;align-items:flex-start;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.5);border-left:3px solid ' + border + ';opacity:0;transition:opacity .3s;pointer-events:auto;word-break:break-word';
  const msgSpan = document.createElement('span');
  msgSpan.style.flex = '1';
  msgSpan.textContent = msg;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;font-weight:700;padding:0;flex-shrink:0;line-height:1;margin-top:1px';
  closeBtn.onclick = () => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 300); };
  notif.appendChild(msgSpan);
  notif.appendChild(closeBtn);
  container.appendChild(notif);
  requestAnimationFrame(() => { notif.style.opacity = '1'; });
}


function showMktToast(msg, duration = 3000, sticky = false) {
  let toast = document.getElementById('mkt-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mkt-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:opacity .3s;max-width:90vw;display:flex;align-items:center;gap:10px;box-shadow:0 4px 24px rgba(0,0,0,.4);pointer-events:none';
    document.body.appendChild(toast);
  }
  // Clear old content
  toast.innerHTML = '';
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  toast.appendChild(msgSpan);

  // Determine if sticky — errors and done messages always sticky
  const isError = msg.startsWith('❌') || msg.startsWith('⚠️');
  const isDone  = msg.startsWith('✅');
  const isSticky = sticky || isError || isDone;

  if (isSticky) {
    toast.style.pointerEvents = 'auto'; // enable clicks for close button
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;padding:0 0 0 8px;flex-shrink:0;line-height:1;font-weight:700';
    closeBtn.onclick = () => { toast.style.opacity = '0'; toast.style.pointerEvents = 'none'; };
    toast.appendChild(closeBtn);
    // Color by type
    toast.style.background = isError ? '#7f1d1d' : isDone ? '#14532d' : '#111827';
    toast.style.borderLeft = isError ? '3px solid #ef4444' : isDone ? '3px solid #22c55e' : 'none';
    clearTimeout(toast._t);
    toast._t = null;
  } else {
    toast.style.background = '#111827';
    toast.style.borderLeft = 'none';
    toast.style.pointerEvents = 'none';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, duration);
  }
  toast.style.opacity = '1';
}


function renderComingSoon(title) {
  setContent(`<div class="mkt-empty">
    <div class="mkt-empty-icon">🚧</div>
    <div class="mkt-empty-title">${title}</div>
    <div style="font-size:12px;margin-top:4px">Coming in next build</div>
  </div>`);
}

// ── COMMAND CENTRE ──
async function generateReelScript(topic, event) {
  if (event) event.stopPropagation();
  if (!topic) { showMktToast('No topic for this reel'); return; }

  const btn = event?.target;
  if (btn) { btn.textContent = '⏳ Writing…'; btn.disabled = true; }
  showMktToast('🎬 Generating reel script for: ' + topic);

  try {
    const { data: bp } = await sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null}));

    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Reel Script Generator',
        prompt: `Write a complete Instagram/YouTube Shorts reel script for V Wholesale, Vijayawada.

TOPIC: ${topic}
STORE: V Wholesale | Visit V Wholesale| 8712697930

Return JSON:
{
  "duration": "30-45 seconds",
  "hook": "First 3 seconds — what to say/show to stop the scroll",
  "shots": [
    {"scene": 1, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 5},
    {"scene": 2, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 8},
    {"scene": 3, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 8},
    {"scene": 4, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 7},
    {"scene": 5, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 7}
  ],
  "voiceover": "Optional spoken script that matches the shots",
  "telugu_hook": "The hook translated to Telugu for Telugu audience version",
  "caption": "Instagram caption with hook + hashtags",
  "hashtags": ["#Vijayawada","#HomeRenovation","...12 more"],
  "best_time_to_post": "e.g. Tuesday 7pm"
}`,
        context: { topic }
      })
    });
    const data = await res.json();
    const script = data.output;
    if (!script) throw new Error('Script generation failed');

    // Show in a modal overlay
    const shots = (script.shots||[]).map((sh, i) =>
      `<div style="padding:8px;background:var(--bg3);border-radius:6px;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:var(--gold)">Scene ${i+1} · ${sh.duration_sec||'?'}s</div>
        <div style="font-size:11px;margin-top:3px"><b>📹 Film:</b> ${sh.what_to_film}</div>
        <div style="font-size:11px;margin-top:2px"><b>📝 Text:</b> ${sh.onscreen_text}</div>
      </div>`).join('');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
    ov.innerHTML = `
      <div style="max-width:500px;margin:0 auto;background:var(--bg2);border-radius:12px;padding:20px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-size:15px;font-weight:900">🎬 Reel Script: ${topic}</div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
        </div>
        <div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--gold)">⚡ HOOK (first 3 seconds)</div>
          <div style="font-size:13px;margin-top:4px">${script.hook||''}</div>
          ${script.telugu_hook ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">తెలుగు: ${script.telugu_hook}</div>` : ''}
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">SHOT LIST · ${script.duration||'30-45 seconds'}</div>
        ${shots}
        ${script.voiceover ? `<div style="margin-top:10px;padding:8px;background:var(--bg3);border-radius:6px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px">🎙️ VOICEOVER</div><div style="font-size:11px;line-height:1.8">${script.voiceover}</div></div>` : ''}
        <div style="margin-top:10px;padding:8px;background:var(--bg3);border-radius:6px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px">📌 CAPTION + HASHTAGS</div>
          <div style="font-size:11px;line-height:1.8">${script.caption||''}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(script)},null,2)).then(()=>showMktToast('📋 Script copied!'))" class="mkt-btn mkt-btn-ghost" style="flex:1;font-size:11px;padding:8px">📋 Copy All</button>
          <button onclick="this.closest('[style*=fixed]').remove()" class="mkt-btn mkt-btn-primary" style="flex:1;font-size:11px;padding:8px">✓ Got It</button>
        </div>
        ${script.best_time_to_post ? `<div style="font-size:10px;color:var(--text3);text-align:center;margin-top:8px">Best time to post: ${script.best_time_to_post}</div>` : ''}
      </div>`;
    document.body.appendChild(ov);
    showMktToast('✅ Reel script ready!');
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '🎬 Get Script'; btn.disabled = false; }
  }
}


async function renderApprovals() {
  const { data: approvals } = await sb.from('marketing_approvals').select('*').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const pending = (approvals||[]).filter(a=>a.status==='pending');
  const done = (approvals||[]).filter(a=>a.status!=='pending');

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Approvals Queue</h3>
    <div style="font-size:12px;color:var(--text3)">Review and approve AI-recommended actions before execution</div>
  </div>

  ${pending.length === 0 ? `
  <div class="mkt-card">
    <div class="mkt-empty">
      <div class="mkt-empty-icon">✅</div>
      <div class="mkt-empty-title">All Clear</div>
      <div style="font-size:12px;color:var(--text3)">No pending approvals. Run the AI CMO to generate recommendations.</div>
      <button class="mkt-btn mkt-btn-primary" onclick="mktNav('cmo');setTimeout(()=>generateCMOBrief(),400)" style="margin-top:16px">🧠 Run AI CMO</button>
    </div>
  </div>` : `
  <div style="display:grid;gap:10px">
    ${pending.map(a => `
    <div class="mkt-card" style="border-left:4px solid var(--gold)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:800">${a.title}</div>
          <div style="font-size:11px;color:var(--text3)">${a.agent_name||'AI'} · ${new Date(a.created_at).toLocaleDateString('en-IN')}</div>
        </div>
        <span class="badge badge-gold">pending</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${a.description}</div>
      ${a.estimated_cost > 0 ? `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Estimated cost: ₹${a.estimated_cost}</div>` : ''}
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" onclick="approveAction(${a.id})">✅ Approve</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="rejectAction(${a.id})" style="color:var(--red)">❌ Reject</button>
      </div>
    </div>`).join('')}
  </div>`}

  ${done.length > 0 ? `
  <div class="mkt-card" style="margin-top:12px">
    <div class="mkt-card-title">History</div>
    <table class="mkt-table">
      <tr><th>Action</th><th>Status</th><th>Date</th></tr>
      ${done.map(a=>`<tr>
        <td style="font-weight:700">${a.title}</td>
        <td><span class="badge ${a.status==='approved'?'badge-green':'badge-red'}">${a.status}</span></td>
        <td style="color:var(--text3)">${new Date(a.created_at).toLocaleDateString('en-IN')}</td>
      </tr>`).join('')}
    </table>
  </div>` : ''}
  `);
}

async function renderGBP() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div>`);

  const { data: conn } = await sb.from('social_connections').select('*').eq('platform','gbp').single().then(r=>r,()=>({data:null}));
  const isConnected = conn?.status === 'connected' && conn?.access_token_set;

  // Handle OAuth callback from URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gbp') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => showMktToast('✅ Google Business Profile connected!'), 300);
  }

  // Load previous posts for learning context
  const { data: prevPosts } = await sb.from('marketing_audit_logs')
    .select('details,created_at').eq('action','gbp_post_created')
    .order('created_at',{ascending:false}).limit(5)
    .then(r=>r,()=>({data:[]}));

  // Get next topic from content calendar
  const today = new Date().toISOString().split('T')[0];
  const { data: calItem } = await sb.from('content_calendar')
    .select('topic,content_type,notes,cal_date')
    .gte('cal_date', today)
    .in('status',['planned','scripted'])
    .order('cal_date',{ascending:true})
    .limit(1).maybeSingle()
    .then(r=>r,()=>({data:null}));

  const suggestedTopic = calItem?.topic || '';

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📍 Google Business Profile</h3>
      <div style="font-size:12px;color:var(--text3)">Post updates and offers to Google Maps</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span class="badge ${isConnected?'badge-green':'badge-gray'}">${isConnected?'✅ Connected':'Not Connected'}</span>
      ${isConnected ? '<button onclick="disconnectGBP()" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer">Disconnect</button>' : ''}
    </div>
  </div>

  ${!isConnected ? `
  <div class="mkt-card" style="text-align:center;padding:32px;margin-bottom:16px">
    <div style="font-size:40px;margin-bottom:12px">📍</div>
    <div style="font-size:14px;font-weight:700;margin-bottom:6px">Connect Google Business Profile</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:20px">Connect once to enable GBP posting from this portal</div>
    <button class="mkt-btn mkt-btn-primary" onclick="connectGBP()" style="padding:12px 28px;font-size:14px;font-weight:700">🔗 Connect GBP</button>
  </div>` : ''}

  <!-- MAIN POST CREATOR — Clean, minimal UI -->
  <div class="mkt-card" style="margin-bottom:14px">

    <!-- Topic selector -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Post Topic</div>
      <div style="display:flex;gap:8px">
        <input id="gbp-topic" class="mkt-form-input" style="flex:1" placeholder="What is this post about?"
          value="${suggestedTopic}" oninput="gbpTopicChanged()">
        <select id="gbp-post-type" class="mkt-form-select" style="width:140px">
          <option value="standard">📢 Update</option>
          <option value="offer">💰 Offer</option>
          <option value="event">📅 Event</option>
        </select>
      </div>
      ${calItem ? `<div style="font-size:11px;color:var(--gold);margin-top:4px">📅 From your content calendar: ${calItem.cal_date} — ${calItem.content_type||'post'}</div>` : ''}
    </div>

    <!-- ONE button — everything happens automatically -->
    <button id="gbp-create-btn" class="mkt-btn mkt-btn-primary" onclick="createGBPPost()" 
      style="width:100%;padding:16px;font-size:15px;font-weight:900;letter-spacing:.3px">
      ✨ Create GBP Post
    </button>

    <!-- Progress indicator — shows during AI processing -->
    <div id="gbp-progress" style="display:none;margin-top:16px">
      <div style="display:grid;gap:6px" id="gbp-steps"></div>
    </div>
  </div>

  <!-- OUTPUT — appears after creation -->
  <div id="gbp-output" style="display:none">

    <!-- Content preview -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Post Content</div>
        <button onclick="regenerateGBPContent()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Regenerate</button>
      </div>
      <textarea id="gbp-text" class="mkt-form-input" rows="6" style="font-size:13px;line-height:1.7;resize:vertical"></textarea>
    </div>

    <!-- Image section — 2 variations -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Post Image</div>
        <div style="display:flex;gap:6px">
          <button onclick="regenerateGBPImage()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 New Images</button>
          <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px;cursor:pointer;margin:0">
            📁 Upload
            <input type="file" id="gbp-image-upload" accept="image/jpeg,image/png,image/webp" onchange="handleGBPImageUpload(this)" style="display:none">
          </label>
        </div>
      </div>

      <!-- Image variations grid -->
      <div id="gbp-variations" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"></div>
      <input type="hidden" id="gbp-image-url">

      <!-- Selected image preview -->
      <div id="gbp-selected-preview" style="display:none;border-radius:8px;overflow:hidden;border:2px solid var(--gold)">
        <img id="gbp-preview-img" src="" style="width:100%;max-height:240px;object-fit:cover;display:block;cursor:zoom-in" onclick="openGBPImageFullscreen(this.src)">
        <div style="background:rgba(0,0,0,.6);padding:6px 10px;display:flex;justify-content:space-between;align-items:center">
          <span id="gbp-preview-label" style="font-size:10px;color:#fff"></span>
          <button onclick="openGBPImageFullscreen(document.getElementById('gbp-preview-img').src)" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">⛶ Fullscreen</button>
        </div>
      </div>
    </div>

    <!-- Verify + Publish -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div id="gbp-verify-result" style="display:none;margin-bottom:12px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="mkt-btn mkt-btn-ghost" onclick="verifyGBPPost()" style="padding:12px;font-weight:700">🔍 Verify Content</button>
        <button class="mkt-btn mkt-btn-primary" onclick="publishGBPPost()" style="padding:12px;font-weight:700">🚀 Publish to GBP</button>
      </div>
    </div>
  </div>

  <!-- Post history -->
  <div class="mkt-card">
    <div class="mkt-card-title">📋 Recent GBP Posts</div>
    <div id="gbp-history">
      ${(prevPosts||[]).length ? (prevPosts||[]).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:18px">📍</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600">${p.details?.post_text||p.details?.topic||'GBP Post'}</div>
            <div style="font-size:10px;color:var(--text3)">${new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <span class="badge badge-green">Posted</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">No posts yet</div>'}
    </div>
  </div>`);
}

// Track step progress
async function renderAgents() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading agents…</div>`);

  const [
    { data: notifications },
    { data: agentRuns }
  ] = await Promise.all([
    sb.from('agent_notifications')
      .select('*')
      .or('resolved.eq.false,resolved.is.null')
      .order('created_at',{ascending:false})
      .limit(30)
      .then(r=>r,()=>({data:[]})),
    sb.from('ai_agent_runs').select('*').order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]}))
  ]);

  const pending = (notifications||[]).filter(n => n.response === 'pending');
  const recent = (notifications||[]).filter(n => n.response !== 'pending').slice(0,8);

  const typeIcon = {
    trend_alert:'🔥',
    approval_request:'✅',
    monthly_review:'📊',
    quarterly_review:'📈',
    performance_report:'📉'
  };
  const typeLabel = {
    trend_alert:'Trend Alert',
    approval_request:'Content Ready for Approval',
    monthly_review:'Monthly Review',
    quarterly_review:'Quarterly Review',
    performance_report:'Performance Report'
  };

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">🤖 AI Agents</h3>
      <div style="font-size:12px;color:var(--text3)">Agents create content automatically — you approve before publishing</div>
    </div>
    ${pending.length
      ? `<span class="badge badge-red">${pending.length} need approval</span>`
      : '<span class="badge badge-green">All clear</span>'}
  </div>

  <!-- HOW IT WORKS -->
  <div class="mkt-card" style="margin-bottom:14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2)">
    <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">⚡ How automation works</div>
    <div style="display:flex;gap:0;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--text2)">
      ${['📅 Calendar plans the day','→','🤖 Agent auto-creates content for all channels','→','📬 Notification sent here','→','✅ You approve','→','🚀 Published everywhere'].map(s=>
        s==='→'
          ? `<span style="color:var(--text3);margin:0 6px">→</span>`
          : `<span style="background:var(--bg3);border-radius:6px;padding:3px 8px;margin:2px">${s}</span>`
      ).join('')}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">
      📅 Go to Calendar → click <b>⚡ Auto-Create</b> on any planned day → content appears here for your approval
    </div>
  </div>

  <!-- AGENT CARDS -->
  <div style="display:grid;gap:8px;margin-bottom:16px">
    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">🔥</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Trend Scout</div>
          <div style="font-size:11px;color:var(--text3)">Scans home building trends for Vijayawada · alerts when opportunity found</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Last run: ${agentRuns?.find(r=>r.agent_name==='Trend Scout')?.created_at
            ? new Date(agentRuns.find(r=>r.agent_name==='Trend Scout').created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
            : 'Never'}</div>
        </div>
        <button onclick="runTrendScout(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">▶ Run</button>
      </div>
      <div id="trend-scout-result"></div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📅</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Calendar Auto-Creator</div>
          <div style="font-size:11px;color:var(--text3)">Opens calendar → click ⚡ Auto-Create on any day → content created for all channels automatically</div>
        </div>
        <button onclick="mktNav('calendar')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Open Calendar</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📊</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Review Agent</div>
          <div style="font-size:11px;color:var(--text3)">Monthly + quarterly performance analysis with AI recommendations</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="generateReview('monthly',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 10px">Monthly</button>
          <button onclick="generateReview('quarterly',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 10px">Quarterly</button>
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">💬</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">WhatsApp Content Prep</div>
          <div style="font-size:11px;color:var(--text3)">Generate broadcast messages ready to send via Interakt</div>
        </div>
        <button onclick="generateWhatsAppBroadcast()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">⭐</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Review Reply Generator</div>
          <div style="font-size:11px;color:var(--text3)">Auto-generate professional replies to Google reviews</div>
        </div>
        <button onclick="generateReviewReply()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">👷</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Contractor Club Content Kit</div>
          <div style="font-size:11px;color:var(--text3)">Generate ready-made posts for contractors to share on WhatsApp/Instagram</div>
        </div>
        <button onclick="generateContractorContent()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">🚀</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Bulk Generate This Month</div>
          <div style="font-size:11px;color:var(--text3)">Generate content for all planned calendar days in one click</div>
        </div>
        <button onclick="bulkGenerateMonth()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">🚀 Bulk Run</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">⭐</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Post-Purchase Review Requests</div>
          <div style="font-size:11px;color:var(--text3)">Auto-send review requests to recent customers via Email + WhatsApp</div>
        </div>
        <button onclick="runReviewRequestAgent(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">▶️ Run Now</button>
      </div>
      <div id="review-request-output" style="margin-top:10px"></div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📊</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Campaign ROI Tracker</div>
          <div style="font-size:11px;color:var(--text3)">Link marketing campaigns to billing data to track real revenue</div>
        </div>
        <button onclick="mktNav('analytics')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">View →</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📝</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">SEO Blog Generator</div>
          <div style="font-size:11px;color:var(--text3)">Auto-generate SEO blog posts targeting Vijayawada keywords for vwholesale.in</div>
        </div>
        <button onclick="generateSEOBlogPost(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
      <div id="seo-blog-output" style="margin-top:10px"></div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">▶️</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">YouTube SEO Optimizer</div>
          <div style="font-size:11px;color:var(--text3)">Generate optimized titles, descriptions and tags for YouTube videos</div>
        </div>
        <button onclick="generateYouTubeSEO(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Optimize</button>
      </div>
      <div id="yt-seo-output" style="margin-top:10px"></div>
    </div>
  </div>

  <!-- PENDING APPROVALS -->
  ${pending.length ? `
  <div style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">
    📬 Waiting for your approval
    <span class="badge badge-red">${pending.length}</span>
  </div>
  <div style="display:grid;gap:10px;margin-bottom:20px">
    ${pending.map(n => `
    <div class="mkt-card" style="border-left:3px solid ${n.notification_type==='trend_alert'?'#f59e0b':'var(--gold)'}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:24px;flex-shrink:0">${typeIcon[n.notification_type]||'🔔'}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3)">${typeLabel[n.notification_type]||n.notification_type}</div>
            <div style="font-size:10px;color:var(--text3)">${new Date(n.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style="font-size:12px;color:var(--text1);line-height:1.8;white-space:pre-wrap;margin-bottom:10px;max-height:120px;overflow-y:auto">${n.message}</div>
          <div style="display:flex;gap:8px">
            <button onclick="respondNotification('${n.id}','yes',this)" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:8px 16px">✅ Approve & Publish</button>
            <button onclick="respondNotification('${n.id}','no',this)" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 16px">✏️ Edit First</button>
            <button onclick="respondNotification('${n.id}','dismiss',this)" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--text3)">✗ Skip</button>
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>` : `
  <div class="mkt-card" style="text-align:center;padding:20px;margin-bottom:16px">
    <div style="font-size:28px;margin-bottom:8px">📭</div>
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">No pending approvals</div>
    <div style="font-size:12px;color:var(--text3)">Go to Calendar → click ⚡ Auto-Create on a planned day to generate content</div>
    <button onclick="mktNav('calendar')" class="mkt-btn mkt-btn-primary" style="margin-top:12px;padding:8px 20px;font-size:12px">📅 Open Calendar</button>
  </div>`}

  <!-- RECENT ACTIVITY -->
  ${recent.length ? `
  <div style="font-size:13px;font-weight:700;margin-bottom:8px">Recent activity</div>
  <div style="display:grid;gap:5px">
    ${recent.map(n=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg3);border-radius:8px">
      <span style="font-size:16px">${typeIcon[n.notification_type]||'🔔'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.message?.slice(0,80)||''}…</div>
        <div style="font-size:10px;color:var(--text3)">${new Date(n.created_at).toLocaleString('en-IN',{day:'numeric',month:'short'})} · ${n.response||'seen'}</div>
      </div>
      <span class="badge ${n.response==='yes'?'badge-green':'badge-gray'}">${n.response==='yes'?'Approved':n.response==='no'?'Editing':'Skipped'}</span>
    </div>`).join('')}
  </div>` : ''}
  `);
}


async function runTrendScout(btn) {
  if (btn) { btn.textContent = '⏳ Scanning…'; btn.disabled = true; }
  const el = document.getElementById('trend-scout-result');
  if (el) el.innerHTML = '<span style="color:var(--text3)">⏳ Scanning trends for Vijayawada home building…</span>';

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/trend-scout', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    if (data.alerted) {
      if (el) el.innerHTML = `<div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);border-radius:8px;padding:10px;margin-top:6px">
        <div style="font-size:12px;font-weight:700;color:var(--gold)">🔥 Trend found!</div>
        <div style="font-size:12px;margin:4px 0"><b>Trend:</b> ${data.trend}</div>
        <div style="font-size:12px;margin:4px 0"><b>Idea:</b> ${data.content_idea}</div>
        <div style="font-size:11px;color:var(--text3)">Urgency: ${data.urgency} · Saved to notifications</div>
      </div>`;
      showMktToast('🔥 Trend found — check notifications!');
    } else {
      if (el) el.innerHTML = `<span style="color:var(--text3)">✅ Scanned at ${new Date().toLocaleTimeString('en-IN')} — no high-relevance trends right now (relevance: ${data.relevance}/10)</span>`;
      showMktToast('✅ No trending topics right now');
    }
  } catch(e) {
    if (el) el.innerHTML = `<span style="color:var(--red)">❌ ${e.message}</span>`;
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '▶ Run Now'; btn.disabled = false; }
  }
}

async function runReview(type, btn) {
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
  showMktToast('📊 Generating '+type+' review…');
  try {
    const now = new Date();
    const period_label = type === 'quarterly'
      ? now.getFullYear()+'-Q'+Math.ceil((now.getMonth()+1)/3)
      : now.toISOString().slice(0,7);
    const start_date = type === 'quarterly'
      ? new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1).toISOString()
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const res = await fetch(MKT_SB_URL+'/functions/v1/content-notifications', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_review', period_type:type, period_label, start_date })
    });
    const data = await res.json();
    showMktToast('✅ '+type.charAt(0).toUpperCase()+type.slice(1)+' review generated');
    setTimeout(() => renderAgents(), 1000);
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = type.charAt(0).toUpperCase()+type.slice(1); btn.disabled = false; }
  }
}

async function respondNotification(id, response, btn) {
  if (btn) { btn.disabled = true; }
  try {
    await sb.from('agent_notifications').update({
      response, responded_at: new Date().toISOString(), resolved: response !== 'pending'
    }).eq('id', id);

    if (response === 'yes') {
      // Check if it's a trend alert — open content studio with suggestion
      const { data: notif } = await sb.from('agent_notifications').select('notification_type,message').eq('id',id).single().then(r=>r,()=>({data:null}));
      if (notif?.notification_type === 'trend_alert') {
        showMktToast('✅ Approved — opening Content Studio to create trend post');
        setTimeout(() => mktNav('content'), 800);
      } else {
        showMktToast('✅ Approved');
      }
    } else {
      showMktToast(response === 'no' ? '✗ Skipped' : 'Dismissed');
    }
    setTimeout(() => renderAgents(), 600);
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) btn.disabled = false;
  }
}


async function renderBrandProfile() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading brand profile…</div>`);

  const { data: bp } = await sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null}));

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h3 style="font-size:16px;font-weight:900">🏷️ Brand Profile & Voice</h3>
      <div style="font-size:12px;color:var(--text3)">Defines how AI writes for V Wholesale across all channels</div>
    </div>
    <button onclick="saveBrandProfile()" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:8px 16px;font-weight:700">💾 Save</button>
  </div>

  <div style="display:grid;gap:12px">

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">🏪 Store Identity</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Brand name</label>
          <input id="bp-name" class="mkt-form-input" value="${bp?.name||'V Wholesale'}" placeholder="V Wholesale">
        </div>
        <div>
          <label class="mkt-form-label">Tagline</label>
          <input id="bp-tagline" class="mkt-form-input" value="${bp?.tagline||'Home Depot for Tier 2 India'}" placeholder="Your tagline">
        </div>
        <div>
          <label class="mkt-form-label">Store address</label>
          <input id="bp-address" class="mkt-form-input" value="${bp?.address||'Visit V Wholesale'}" placeholder="Address">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="mkt-form-label">Phone</label>
            <input id="bp-phone" class="mkt-form-input" value="${bp?.phone||'8712697930'}" placeholder="Phone">
          </div>
          <div>
            <label class="mkt-form-label">Website</label>
            <input id="bp-website" class="mkt-form-input" value="${bp?.website||'vwholesale.in'}" placeholder="Website">
          </div>
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">🎯 Target Audience</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Primary audiences</label>
          <input id="bp-audience" class="mkt-form-input" value="${bp?.target_audience||'Home owners, Contractors, Architects, Interior Designers, Builders'}" placeholder="Who you sell to">
        </div>
        <div>
          <label class="mkt-form-label">Target geography</label>
          <input id="bp-geography" class="mkt-form-input" value="${bp?.geography||'Vijayawada + 100km radius — Guntur, Eluru, Tenali, Mangalagiri, Machilipatnam'}" placeholder="Target area">
        </div>
        <div>
          <label class="mkt-form-label">Key products / categories</label>
          <input id="bp-products" class="mkt-form-input" value="${bp?.products||'Tiles, Granite, Marble, Sanitaryware, Paints, Electricals, TISAN (private label)'}" placeholder="Products">
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">🗣️ Brand Voice</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Tone of voice</label>
          <select id="bp-tone" class="mkt-form-select">
            ${['Confident & Premium','Warm & Friendly','Expert & Educational','Bold & Direct','Local & Approachable'].map(t=>`<option value="${t}" ${(bp?.tone||'Confident & Premium')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mkt-form-label">Language preference</label>
          <select id="bp-language" class="mkt-form-select">
            ${[{v:'bilingual',l:'Bilingual — Telugu headline + English body (recommended)'},{v:'te',l:'Telugu first'},{v:'en',l:'English first'},{v:'hi',l:'Hindi (for North Indian contractors)'}].map(o=>`<option value="${o.v}" ${(bp?.language_pref||'bilingual')===o.v?'selected':''}>${o.l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mkt-form-label">Key messages to always include</label>
          <textarea id="bp-messages" class="mkt-form-input" rows="2" placeholder="e.g. Vijayawada's largest tile showroom, 5000+ products, expert guidance">${bp?.key_messages||'Vijayawada\u2019s premium home building store \u00B7 5000+ products \u00B7 Expert guidance \u00B7 Contractor Club benefits'}</textarea>
        </div>
        <div>
          <label class="mkt-form-label">Words / phrases to AVOID</label>
          <textarea id="bp-avoid" class="mkt-form-input" rows="2" placeholder="e.g. cheap, discount, cheap prices — use 'value' instead">${bp?.words_to_avoid||'cheap, cheapest, low quality, best price (use value, premium, competitive pricing)'}</textarea>
        </div>
        <div>
          <label class="mkt-form-label">Competitors (internal only — never mention in posts)</label>
          <input id="bp-competitors" class="mkt-form-input" value="${bp?.competitors||'IBO, Hippo Homes, local tile shops'}" placeholder="Competitors">
        </div>
        <div>
          <label class="mkt-form-label">Unique selling points (USPs)</label>
          <textarea id="bp-usps" class="mkt-form-input" rows="3" placeholder="What makes V Wholesale different">${bp?.usps||'Largest selection in Vijayawada \u00B7 Contractor Club with 2% referral bonus \u00B7 TISAN private label \u00B7 Expert staff \u00B7 Home delivery \u00B7 EMI options'}</textarea>
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📢 Content Defaults</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Default CTA (Call to Action)</label>
          <input id="bp-cta" class="mkt-form-input" value="${bp?.default_cta||'Visit us at Visit V Wholesale \u00B7 Call 8712697930 \u00B7 vwholesale.in'}" placeholder="Your standard CTA">
        </div>
        <div>
          <label class="mkt-form-label">Always-on hashtags (added to every post)</label>
          <input id="bp-hashtags" class="mkt-form-input" value="${bp?.always_hashtags||'#VWholesale #Vijayawada #HomeRenovation #BuildingMaterials #Tiles'}" placeholder="#yourbrand #yourcity">
        </div>
        <div>
          <label class="mkt-form-label">Instagram handle</label>
          <input id="bp-instagram" class="mkt-form-input" value="${bp?.instagram_handle||'@vwholesaleindia'}" placeholder="@handle">
        </div>
      </div>
    </div>

    <button onclick="saveBrandProfile()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700">💾 Save Brand Profile</button>
  </div>`);
}

async function saveBrandProfile() {
  const data = {
    name: document.getElementById('bp-name')?.value||'V Wholesale',
    tagline: document.getElementById('bp-tagline')?.value||'',
    address: document.getElementById('bp-address')?.value||'',
    phone: document.getElementById('bp-phone')?.value||'',
    website: document.getElementById('bp-website')?.value||'',
    target_audience: document.getElementById('bp-audience')?.value||'',
    geography: document.getElementById('bp-geography')?.value||'',
    products: document.getElementById('bp-products')?.value||'',
    tone: document.getElementById('bp-tone')?.value||'Confident & Premium',
    language_pref: document.getElementById('bp-language')?.value||'bilingual',
    key_messages: document.getElementById('bp-messages')?.value||'',
    words_to_avoid: document.getElementById('bp-avoid')?.value||'',
    competitors: document.getElementById('bp-competitors')?.value||'',
    usps: document.getElementById('bp-usps')?.value||'',
    default_cta: document.getElementById('bp-cta')?.value||'',
    always_hashtags: document.getElementById('bp-hashtags')?.value||'',
    instagram_handle: document.getElementById('bp-instagram')?.value||'',
    updated_at: new Date().toISOString()
  };

  const { data: existing } = await sb.from('brand_profile').select('id').limit(1).maybeSingle().then(r=>r,()=>({data:null}));
  if (existing?.id) {
    await sb.from('brand_profile').update(data).eq('id', existing.id);
  } else {
    await sb.from('brand_profile').insert({...data, created_at:new Date().toISOString()});
  }
  showMktToast('✅ Brand profile saved — AI will use this for all future content');
}


// ── BULK CONTENT GENERATION ──
async function bulkGenerateMonth() {
  const { data: calItems } = await sb.from('content_calendar')
    .select('*')
    .gte('cal_date', new Date().toISOString().split('T')[0])
    .lte('cal_date', new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split('T')[0])
    .neq('status','published')
    .order('cal_date',{ascending:true})
    .then(r=>r,()=>({data:[]}));

  const pending = (calItems||[]).filter(c => c.status === 'planned');
  if (!pending.length) { showMktToast('No planned posts this month — add some to the calendar first'); return; }

  const confirmed = confirm(`Generate content for all ${pending.length} planned posts this month? This will create content for all channels and send for approval.`);
  if (!confirmed) return;

  showMktToast(`⏳ Generating ${pending.length} posts… this will take a moment`);
  let success = 0;

  for (const item of pending) {
    try {
      await quickCreateFromCalendar(item.topic, item.content_type||'image', 'bilingual');
      success++;
      showMktToast(`✅ ${success}/${pending.length} — ${item.topic.slice(0,30)}`);
      await new Promise(r => setTimeout(r, 2000)); // Rate limit between calls
    } catch(e) {
      console.error('Bulk gen error:', item.topic, e.message);
    }
  }
  showMktToast(`✅ Bulk generation complete — ${success}/${pending.length} posts created. Check AI Agents for approvals.`);
  mktNav('agents');
}

// ── HASHTAG RESEARCH ──
async function generateHashtags(topic, btn) {
  if (btn) { btn.textContent='⏳…'; btn.disabled=true; }
  try {
    const { data: bp } = await sb.from('brand_profile').select('always_hashtags,geography,products').limit(1).maybeSingle().then(r=>r,()=>({data:null}));
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Hashtag Research',
        prompt: `Generate a comprehensive hashtag set for V Wholesale Vijayawada for this topic: "${topic||'home renovation'}"

Geography: ${bp?.geography||'Vijayawada, Andhra Pradesh'}
Products: ${bp?.products||'Tiles, Granite, Marble, Sanitaryware'}
Always-on tags: ${bp?.always_hashtags||'#VWholesale #Vijayawada'}

Return JSON:
{
  "primary": ["#5-8 high-relevance tags for this specific topic"],
  "local": ["#5 Vijayawada/Andhra Pradesh local tags"],
  "category": ["#5 home building category tags"],
  "trending": ["#3 currently trending related tags"],
  "always_on": ["#VWholesale","#Vijayawada","#HomeRenovation","#BuildingMaterials"],
  "full_set": "complete recommended set of 20-25 hashtags as one string"
}`,
        context: { topic }
      })
    });
    const data = await res.json();
    const tags = data.output;
    if (!tags?.full_set) throw new Error('Generation failed');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:480px;border:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">🏷️ Hashtags for: ${topic||'your post'}</div>
        ${[
          {label:'Primary', tags:tags.primary, color:'var(--gold)'},
          {label:'Local', tags:tags.local, color:'#22c55e'},
          {label:'Category', tags:tags.category, color:'#3b82f6'},
          {label:'Trending', tags:tags.trending, color:'#a855f7'},
        ].map(g=>`
        <div style="margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:5px;text-transform:uppercase">${g.label}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${(g.tags||[]).map(t=>`<span style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:3px 8px;font-size:11px;color:${g.color}">${t}</span>`).join('')}
          </div>
        </div>`).join('')}
        <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-top:8px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">FULL SET (copy all)</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.8">${tags.full_set}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="navigator.clipboard.writeText('${(tags.full_set||'').replace(/'/g,"\'")}').then(()=>showMktToast('📋 Copied!'))" class="mkt-btn mkt-btn-primary" style="flex:1;padding:8px;font-size:12px">📋 Copy All</button>
          <button onclick="this.closest('[style*=fixed]').remove()" class="mkt-btn mkt-btn-ghost" style="padding:8px 14px">Close</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🏷️ Hashtags'; btn.disabled=false; } }
}

// ── REVIEW RESPONSE AI ──
async function generateWhatsAppBroadcast(topic, audience) {
  if (!topic) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:440px;border:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">💬 WhatsApp Broadcast Generator</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <div>
            <label class="mkt-form-label">Topic / Campaign</label>
            <input id="wa-topic" class="mkt-form-input" placeholder="e.g. Diwali tile offer, New marble collection, Contractor Club">
          </div>
          <div>
            <label class="mkt-form-label">Target audience</label>
            <select id="wa-audience" class="mkt-form-select">
              <option value="all">All customers</option>
              <option value="contractors">Contractors only</option>
              <option value="homeowners">Home owners</option>
              <option value="architects">Architects & Designers</option>
            </select>
          </div>
          <div>
            <label class="mkt-form-label">Offer / key detail (optional)</label>
            <input id="wa-offer" class="mkt-form-input" placeholder="e.g. 15% off, free delivery above ₹50,000">
          </div>
        </div>
        <button onclick="generateWhatsAppBroadcast(document.getElementById('wa-topic')?.value, document.getElementById('wa-audience')?.value)" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">✨ Generate Messages</button>
        <div id="wa-output" style="margin-top:12px"></div>
      </div>`;
    document.body.appendChild(ov);
    return;
  }

  const outEl = document.getElementById('wa-output');
  if (outEl) outEl.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:12px">⏳ Writing WhatsApp messages…</div>';

  try {
    const offer = document.getElementById('wa-offer')?.value||'';
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'WhatsApp Broadcast',
        prompt: `Write 3 WhatsApp broadcast messages for V Wholesale Vijayawada.

Topic: ${topic}
Audience: ${audience||'all customers'}
Offer/Detail: ${offer||'none'}
Store: V Wholesale | Visit V Wholesale| 8712697930 | vwholesale.in

Rules:
- Each message max 200 characters (WhatsApp best practice)
- Personal, conversational tone (not formal)
- Telugu version for message 3
- Start with greeting, end with CTA
- No formal language

Return JSON:
{
  "message1": "Urgent/offer focused version",
  "message2": "Warm/relationship version",
  "message3": "Telugu version",
  "best_time": "Best time to send this broadcast"
}`,
        context: { topic, audience }
      })
    });
    const data = await res.json();
    const msgs = data.output;
    if (!msgs?.message1) throw new Error('Generation failed');

    if (outEl) outEl.innerHTML = `
      <div style="display:grid;gap:8px;margin-top:4px">
        ${[
          {label:'Version 1 — Offer focused', msg:msgs.message1, color:'var(--gold)'},
          {label:'Version 2 — Relationship', msg:msgs.message2, color:'#22c55e'},
          {label:'Version 3 — Telugu', msg:msgs.message3, color:'#a855f7'},
        ].map(v=>`
        <div style="background:var(--bg3);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:${v.color};margin-bottom:5px;text-transform:uppercase">${v.label}</div>
          <div style="font-size:12px;line-height:1.8;color:var(--text2)">${v.msg}</div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(v.msg)}).then(()=>showMktToast('📋 Copied!'))" class="mkt-btn mkt-btn-ghost" style="margin-top:6px;font-size:10px;padding:3px 10px">📋 Copy</button>
        </div>`).join('')}
        <div style="font-size:11px;color:var(--text3);text-align:center">Best time: ${msgs.best_time||'10am-12pm or 6pm-8pm'}</div>
      </div>`;
  } catch(e) {
    if (outEl) outEl.innerHTML = `<div style="color:var(--red);font-size:11px">❌ ${e.message}</div>`;
  }
}

// ── CONTRACTOR CLUB CONTENT ──
async function generateContractorContent(contractorName, projectType) {
  if (!contractorName) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:440px;border:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">👷 Contractor Club Content Kit</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate ready-made social posts for your contractors to share</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <div>
            <label class="mkt-form-label">Contractor name</label>
            <input id="cc-name" class="mkt-form-input" placeholder="e.g. Ravi Kumar (Painter)">
          </div>
          <div>
            <label class="mkt-form-label">Project type</label>
            <select id="cc-project" class="mkt-form-select">
              <option value="tile-work">Tile flooring / wall work</option>
              <option value="painting">Painting project</option>
              <option value="bathroom">Bathroom renovation</option>
              <option value="kitchen">Kitchen renovation</option>
              <option value="full-home">Full home renovation</option>
              <option value="new-construction">New construction</option>
            </select>
          </div>
          <div>
            <label class="mkt-form-label">Location (optional)</label>
            <input id="cc-location" class="mkt-form-input" placeholder="e.g. Guntur, Vijayawada, Mangalagiri">
          </div>
        </div>
        <button onclick="generateContractorContent(document.getElementById('cc-name')?.value, document.getElementById('cc-project')?.value)" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">✨ Generate Kit</button>
        <div id="cc-output" style="margin-top:12px"></div>
      </div>`;
    document.body.appendChild(ov);
    return;
  }

  const outEl = document.getElementById('cc-output');
  if (outEl) outEl.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:12px">⏳ Creating content kit…</div>';

  try {
    const location = document.getElementById('cc-location')?.value || 'Vijayawada';
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Contractor Content Kit',
        prompt: `Create a social media content kit for a contractor to share about their project.

Contractor: ${contractorName}
Project type: ${projectType||'renovation'}
Location: ${location}
Materials sourced from: V Wholesale, Visit V Wholesale(8712697930)

Generate 3 posts the contractor can copy-paste to their WhatsApp status or Instagram:
1. Project announcement post (when starting work)
2. Mid-project progress update
3. Project completion post (with V Wholesale mention)

Return JSON:
{
  "post1": { "text": "...", "caption": "WhatsApp or Instagram caption" },
  "post2": { "text": "...", "caption": "WhatsApp or Instagram caption" },
  "post3": { "text": "...", "caption": "WhatsApp or Instagram caption — includes V Wholesale mention naturally" },
  "story_text": "One-line story/status text",
  "referral_reminder": "Reminder text about V Wholesale Contractor Club referral bonus"
}`,
        context: { contractorName, projectType, location }
      })
    });
    const data = await res.json();
    const kit = data.output;
    if (!kit?.post1) throw new Error('Generation failed');

    if (outEl) outEl.innerHTML = `
      <div style="display:grid;gap:8px">
        ${[
          {label:'Post 1 — Project Start', post:kit.post1},
          {label:'Post 2 — Progress Update', post:kit.post2},
          {label:'Post 3 — Completion (with V Wholesale)', post:kit.post3},
        ].map((p,i)=>`
        <div style="background:var(--bg3);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:5px;text-transform:uppercase">${p.label}</div>
          <div style="font-size:12px;line-height:1.8;color:var(--text2)">${p.post?.text||''}</div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(p.post?.text||'')}).then(()=>showMktToast('📋 Post ${i+1} copied!'))" class="mkt-btn mkt-btn-ghost" style="margin-top:6px;font-size:10px;padding:3px 10px">📋 Copy</button>
        </div>`).join('')}
        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">💰 REFERRAL REMINDER TO SHARE</div>
          <div style="font-size:11px;color:var(--text2)">${kit.referral_reminder||''}</div>
        </div>
      </div>`;
  } catch(e) {
    if (outEl) outEl.innerHTML = `<div style="color:var(--red);font-size:11px">❌ ${e.message}</div>`;
  }
}

// ── A/B COPY VARIANTS ──
async function generateABVariants(topic, type, btn) {
  if (btn) { btn.textContent='⏳ Generating 3 variants…'; btn.disabled=true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'A/B Variants',
        prompt: `Write 3 different copy variants for the same social media post for V Wholesale Vijayawada.

Topic: ${topic}
Format: ${type||'Instagram post'}
Each variant should have a different angle/hook to test what resonates.

Return JSON:
{
  "variant_a": { "hook": "Angle A label", "text": "Full post copy", "why": "Why this angle might work" },
  "variant_b": { "hook": "Angle B label", "text": "Full post copy", "why": "Why this angle might work" },
  "variant_c": { "hook": "Angle C label", "text": "Full post copy", "why": "Why this angle might work" },
  "recommendation": "Which variant to try first and why"
}`,
        context: { topic, type }
      })
    });
    const data = await res.json();
    const vars = data.output;
    if (!vars?.variant_a) throw new Error('Generation failed');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
    ov.innerHTML = `
      <div style="max-width:520px;margin:0 auto;background:var(--bg2);border-radius:12px;padding:20px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-size:15px;font-weight:700">🧪 A/B Variants: ${topic}</div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
        </div>
        ${['a','b','c'].map(v=>`
        <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:11px;font-weight:700;color:var(--gold)">Variant ${v.toUpperCase()} — ${vars['variant_'+v]?.hook||''}</span>
          </div>
          <div style="font-size:12px;line-height:1.8;color:var(--text2);margin-bottom:8px">${vars['variant_'+v]?.text||''}</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:6px">💡 ${vars['variant_'+v]?.why||''}</div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(vars['variant_'+v]?.text||'')}).then(()=>showMktToast('📋 Variant ${v.toUpperCase()} copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 10px">📋 Copy</button>
        </div>`).join('')}
        ${vars.recommendation ? `<div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px"><div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:4px">⭐ AI Recommendation</div><div style="font-size:11px;color:var(--text2)">${vars.recommendation}</div></div>` : ''}
      </div>`;
    document.body.appendChild(ov);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🧪 A/B Variants'; btn.disabled=false; } }
}

async function renderBrand() {
  const { data: knowledge } = await sb.from('brand_knowledge').select('*').order('category').then(r=>r, ()=>({data:[]}));
  const categories = [...new Set((knowledge||[]).map(k=>k.category))];

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">Brand Knowledge</h3>
      <div style="font-size:12px;color:var(--text3)">Facts and guidelines the AI uses to generate accurate content</div>
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="showAddKnowledge()">+ Add Knowledge</button>
  </div>

  <div id="brand-add-form" style="display:none" class="mkt-card">
    <div class="mkt-card-title">Add Brand Knowledge</div>
    <div class="mkt-grid-2">
      <div class="mkt-form-group">
        <label class="mkt-form-label">Category</label>
        <select id="bk-cat" class="mkt-form-select">
          <option value="business">Business Info</option>
          <option value="positioning">Brand Positioning</option>
          <option value="products">Products & Pricing</option>
          <option value="geography">Geography & Service Area</option>
          <option value="tone">Tone & Voice</option>
          <option value="compliance">Compliance & Prohibited</option>
          <option value="customers">Customer Info</option>
          <option value="faq">FAQ</option>
        </select>
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Title</label>
        <input type="text" id="bk-title" class="mkt-form-input" placeholder="e.g. Store Timings">
      </div>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Content</label>
      <textarea id="bk-content" class="mkt-form-textarea" placeholder="Enter the verified fact or guideline…"></textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="mkt-btn mkt-btn-primary" onclick="saveBrandKnowledge()">Save</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('brand-add-form').style.display='none'">Cancel</button>
    </div>
  </div>

  ${categories.map(cat => `
  <div class="mkt-card">
    <div class="mkt-card-title">${cat.charAt(0).toUpperCase()+cat.slice(1)}</div>
    <div style="display:grid;gap:8px">
      ${(knowledge||[]).filter(k=>k.category===cat).map(k=>`
      <div style="padding:10px;background:var(--bg3);border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:12px;font-weight:700">${k.title}</div>
          <span class="badge ${k.is_approved?'badge-green':'badge-gold'}">${k.is_approved?'approved':'pending'}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5">${k.content}</div>
      </div>`).join('')}
    </div>
  </div>`).join('')}`);
}

async function renderIntegrations() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading integrations…</div>`);

  const [
    { data: settings },
    { data: social }
  ] = await Promise.all([
    sb.from('marketing_settings').select('key,value').then(r=>r,()=>({data:[]})),
    sb.from('social_connections').select('*').then(r=>r,()=>({data:[]}))
  ]);

  const cfg = {};
  (settings||[]).forEach(s => { cfg[s.key] = s.value; });
  const sc = {};
  (social||[]).forEach(s => { sc[s.platform] = s; });

  const gbpOk = sc.gbp?.status === 'connected' && sc.gbp?.access_token_set;
  const metaOk = sc.meta?.status === 'connected';
  const waOk = sc.whatsapp?.status === 'connected';

  const statusBadge = (ok, pendingText) => ok
    ? '<span class="badge badge-green">✅ Connected</span>'
    : pendingText
      ? `<span class="badge badge-yellow">⏳ ${pendingText}</span>`
      : '<span class="badge badge-gray">Not connected</span>';

  setContent(`
  <div style="margin-bottom:20px">
    <h3 style="font-size:16px;font-weight:900">🔌 Integrations</h3>
    <div style="font-size:12px;color:var(--text3)">Connect channels to enable auto-publishing</div>
  </div>

  <!-- GOOGLE BUSINESS PROFILE -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📍</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Google Business Profile</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Post updates, offers and events to Google Maps</div>
      </div>
      ${statusBadge(gbpOk, !gbpOk ? 'API approval pending' : null)}
    </div>
    ${gbpOk ? `
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:var(--text3)">
      ✅ OAuth tokens saved · Case ID: 6-0399000041489 · API approval expected 7-10 working days from submission<br>
      Once approved: auto-posting activates automatically — no code change needed
    </div>` : `
    <button onclick="connectGBP()" class="mkt-btn mkt-btn-primary" style="margin-top:10px;font-size:12px;padding:8px 16px">🔗 Connect GBP</button>`}
  </div>

  <!-- META (Instagram + Facebook) -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📸</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Meta — Instagram + Facebook</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Auto-post to Instagram feed, stories, Facebook post and stories</div>
      </div>
      ${statusBadge(metaOk, null)}
    </div>
    ${metaOk ? `
    <div id="meta-status-detail" style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:#22c55e">
      ✅ Connected · Page: ${cfg.META_PAGE_NAME||'V Wholesale'} · Instagram: @vwholesaleindia
      ${cfg.META_IG_ID ? `(ID: ${cfg.META_IG_ID})` : '— <span style="color:#f59e0b">click Sync Instagram ID</span>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button onclick="fetchMetaIgId()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Sync Instagram ID</button>
      <button onclick="disconnectMeta()" style="background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer">Disconnect</button>
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">🔑 Refresh token (paste from Graph API Explorer → V Wholesale app → Generate Access Token):</div>
      <div style="display:flex;gap:6px">
        <input id="meta-refresh-token" class="mkt-form-input" placeholder="EAAxxxxxxxx" style="font-size:11px;flex:1">
        <button onclick="connectMetaWithToken(document.getElementById('meta-refresh-token')?.value)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;flex-shrink:0">Refresh</button>
      </div>
    </div>
    ` : `
    <div style="margin-top:10px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">To connect Instagram and Facebook, you need a Meta Business account with Pages access.</div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px">Setup steps:</div>
        <div style="display:grid;gap:6px;font-size:11px;color:var(--text2)">
          <div style="display:flex;gap:8px"><span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0">1</span><span>Go to <a href="https://developers.facebook.com/apps" target="_blank" style="color:var(--gold)">developers.facebook.com/apps ↗</a> → Create App → Business type</span></div>
          <div style="display:flex;gap:8px"><span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0">2</span><span>Add Instagram Graph API + Facebook Pages API products</span></div>
          <div style="display:flex;gap:8px"><span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0">3</span><span>Get App ID + App Secret → paste below → click Connect</span></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input id="meta-app-id" class="mkt-form-input" placeholder="Meta App ID" style="font-size:12px">
        <input id="meta-app-secret" class="mkt-form-input" placeholder="Meta App Secret" type="password" style="font-size:12px">
      </div>
      <button onclick="connectMeta()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-size:12px;font-weight:700">🔗 Connect Meta via OAuth</button>
      <div style="margin-top:8px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">OR paste token from Graph API Explorer:</div>
        <div style="display:flex;gap:6px">
          <input id="meta-manual-token" class="mkt-form-input" placeholder="EAAxxxxxxxx" style="font-size:11px;flex:1">
          <button onclick="connectMetaWithToken(document.getElementById('meta-manual-token')?.value)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;flex-shrink:0">Connect</button>
        </div>
      </div>
    </div>`}
  </div>

  <!-- WHATSAPP -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">💬</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">💬 WhatsApp Business (Meta Direct)</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Broadcast messages to customer list + approvals to 9038010175</div>
      </div>
      ${statusBadge(waOk, !waOk ? 'Verify connection' : null)}
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:var(--text3)">
      ${waOk
        ? '✅ Meta Direct API · Phone: +91 8712697930 · No Interakt fees'
        : '⏳ Click Verify to test Meta WhatsApp connection'}
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">☁️ Cloud API registration (one-time)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="waCloudStatus(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">📋 Check Status</button>
        <button onclick="waWebhookCheck(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">🔗 Check Webhook</button>
        <button onclick="waPhoneWebhook(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">📞 Phone Webhook Override</button>
        <button onclick="waAudit(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">🔬 Token Audit</button>
        <input id="wa-register-pin" class="mkt-form-input" placeholder="6-digit PIN" maxlength="6" style="font-size:11px;width:110px">
        <button onclick="waCloudRegister(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">☁️ Register Number</button>
      </div>
      <div id="wa-register-output" style="margin-top:8px"></div>
    </div>
  </div>

  <!-- OPENAI + PEXELS -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🤖</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">OpenAI + Pexels</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">AI content generation + stock photos</div>
      </div>
      <span class="badge badge-green">✅ Active</span>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3)">gpt-4o-mini · gpt-image-1 (quality:high) · Pexels stock fallback</div>
  </div>

  <!-- TREND SCOUT SCHEDULE -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🔥</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Trend Scout — Auto Schedule</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Runs automatically and notifies you when a trend is found</div>
      </div>
      <span id="trend-schedule-status" class="badge badge-gray">Manual only</span>
    </div>
    <div style="margin-top:10px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Select how often to auto-scan:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['Hourly','Every 4h','Twice daily','Daily'].map(freq=>`
        <button onclick="setTrendSchedule('${freq}',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">${freq}</button>`).join('')}
        <button onclick="runTrendScout(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">▶ Run Now</button>
      </div>
    </div>
  </div>

  <!-- YOUTUBE -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">▶️</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">YouTube — @vwholesaleindia</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Track views, subscribers and upload Shorts</div>
      </div>
      <span id="yt-status-badge" class="badge ${cfg.YOUTUBE_API_KEY ? 'badge-green' : 'badge-yellow'}">${cfg.YOUTUBE_API_KEY ? '✅ API Key saved' : '⚙️ API Key needed'}</span>
    </div>
    <div style="margin-top:10px;display:grid;gap:8px">
      <div style="background:var(--bg3);border-radius:8px;padding:10px;font-size:11px;color:var(--text2)">
        <div style="margin-bottom:4px"><b>Channel:</b> V Wholesale India</div>
        <div style="margin-bottom:4px"><b>Channel ID:</b> UCFQfukKHctvBn_cSqBL66zg</div>
        <div><b>URL:</b> youtube.com/@vwholesaleindia</div>
      </div>
      <div>
        <label class="mkt-form-label">YouTube Data API v3 Key</label>
        <input id="yt-api-key" class="mkt-form-input" type="password" placeholder="AIza..." value="${cfg.YOUTUBE_API_KEY||''}" style="font-size:12px">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="saveYouTubeSettings()" class="mkt-btn mkt-btn-primary" style="flex:1;font-size:12px;padding:8px;font-weight:700">
          ${cfg.YOUTUBE_API_KEY ? '🔄 Update & Verify' : '🔗 Connect YouTube'}
        </button>
        ${cfg.YOUTUBE_API_KEY ? '<button onclick="loadYouTubeStats()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 12px">📊 Load Stats</button>' : ''}
      </div>
      <div id="yt-stats-display"></div>
    </div>
  </div>

  <!-- THREADS -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🧵</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Threads @vwholesaleindia</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Auto-post to Threads — token connected</div>
      </div>
      <span id="threads-status-badge" class="badge badge-yellow">⏳ Verify</span>
    </div>
    <div id="threads-status-detail" style="margin-top:8px;font-size:11px;color:var(--text3)">Click Verify to confirm connection</div>
    <div style="margin-top:8px;display:grid;gap:6px">
      <div style="display:flex;gap:6px;align-items:center">
        <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px;cursor:pointer;margin:0;flex-shrink:0">
          📁 Upload Image
          <input type="file" id="threads-test-image-file" accept="image/*" onchange="threadsUploadTestImage(this)" style="display:none">
        </label>
        <div id="threads-test-image-status" style="font-size:11px;color:var(--text3)">No image selected</div>
        <input type="hidden" id="threads-test-image">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="verifyThreadsConnection()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 14px">🔄 Verify</button>
        <button onclick="testThreadsPost()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 14px">🧪 Test Post with Image</button>
      </div>
    </div>
  </div>

  <!-- GITHUB (Blog) -->
  <div class="mkt-card">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📝</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">GitHub (Blog auto-publish)</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">vwholesale.in/blog/ — posts publish automatically</div>
      </div>
      <span class="badge badge-green">✅ Active</span>
    </div>
  </div>`);
}

async function threadsUploadTestImage(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('threads-test-image-status');
  if (status) status.textContent = '⏳ Uploading…';
  try {
    const fname = 'threads/test_'+Date.now()+'_'+file.name.replace(/[^a-z0-9.]/gi,'_').toLowerCase();
    const { error } = await sb.storage.from('marketing-assets').upload(fname, file, {contentType:file.type, upsert:true});
    if (error) throw new Error(error.message);
    const { data: ud } = sb.storage.from('marketing-assets').getPublicUrl(fname);
    document.getElementById('threads-test-image').value = ud.publicUrl;
    if (status) status.innerHTML = '<span style="color:#22c55e">✅ '+file.name+' ready</span>';
    showMktToast('✅ Image uploaded and ready');
  } catch(e) {
    if (status) status.textContent = '❌ '+e.message;
    showMktToast('❌ Upload failed: '+e.message);
  }
}

async function verifyThreadsConnection() {
  const badge = document.getElementById('threads-status-badge');
  const detail = document.getElementById('threads-status-detail');
  if (badge) { badge.textContent = '⏳ Checking…'; badge.className = 'badge badge-gray'; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/threads-api', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'verify'})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    if (badge) { badge.textContent = '✅ Connected'; badge.className = 'badge badge-green'; }
    if (detail) detail.innerHTML = '✅ @'+data.username+' · ID: '+data.id;
    showMktToast('✅ Threads connected: @'+data.username);
  } catch(e) {
    if (badge) { badge.textContent = '❌ Error'; badge.className = 'badge badge-gray'; }
    if (detail) detail.textContent = '❌ '+e.message;
    showMktToast('❌ '+e.message);
  }
}

async function testThreadsPost() {
  if (!confirm('Post a test message to @vwholesaleindia on Threads?')) return;
  const btn = document.querySelector('[onclick="testThreadsPost()"]');
  if (btn) { btn.textContent='⏳ Posting…'; btn.disabled=true; }
  try {
    // Get image: first check manual input, then latest content post
    const manualImgUrl = (document.getElementById('threads-test-image')?.value||'').trim();
    const { data: lp } = await sb.from('content_posts').select('master_image_url').not('master_image_url','is',null).neq('master_image_url','').order('created_at',{ascending:false}).limit(1).maybeSingle().then(r=>r,()=>({data:null}));
    window._latestThreadsImageUrl = manualImgUrl || lp?.master_image_url || '';
    console.log('Threads image URL:', window._latestThreadsImageUrl||'none');

    const res = await fetch(MKT_SB_URL+'/functions/v1/threads-api', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify(Object.assign(
        {text:'V Wholesale — Premium Home Building Materials in Vijayawada. Tiles, Granite, Marble & more. Visit us at Visit V Wholesale. 📞 8712697930 | vwholesale.in\n\n#Vijayawada #HomeRenovation #VWholesale #Tiles #Marble'},
        window._latestThreadsImageUrl ? {action:'publish_image', image_url:window._latestThreadsImageUrl} : {action:'publish_text'}
      ))
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    showMktToast('✅ Test posted to Threads!');
    if (data.url) window.open(data.url, '_blank');
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🧪 Test Post'; btn.disabled=false; } }
}

async function checkAndRefreshMetaToken() {
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value')
      .in('key',['META_TOKEN_EXPIRY','META_APP_ID','META_APP_SECRET','META_ACCESS_TOKEN'])
      .then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});

    if (!cfg.META_ACCESS_TOKEN || !cfg.META_APP_ID || !cfg.META_APP_SECRET) return;

    const expiry = parseInt(cfg.META_TOKEN_EXPIRY||'0');
    const daysLeft = expiry ? Math.floor((expiry - Date.now()) / 86400000) : 0;

    // Refresh if expiring within 10 days or already expired
    if (expiry && daysLeft > 10) {
      console.log('[Meta] Token valid for', daysLeft, 'days');
      return;
    }

    console.log('[Meta] Token expiring soon (', daysLeft, 'days) — refreshing...');
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-setup', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'refresh_token',
        app_id: cfg.META_APP_ID,
        app_secret: cfg.META_APP_SECRET,
        token: cfg.META_ACCESS_TOKEN
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log('[Meta] Token refreshed successfully — valid for', data.expires_days, 'days');
      if (daysLeft <= 0) showMktToast('✅ Meta token refreshed automatically');
    } else {
      // Show warning if token is expired and couldn't refresh
      if (daysLeft <= 0) {
        showMktToast('⚠️ Meta token expired — go to Integrations → paste new token from developers.facebook.com/tools/explorer');
      }
    }
  } catch(e) {
    console.log('[Meta] Token refresh check failed:', e.message);
  }
}

async function autoSyncInstagramId() {
  // Silently keeps Instagram ID in sync — runs on every portal load
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value')
      .in('key',['META_ACCESS_TOKEN','META_PAGE_ID','META_PAGE_TOKEN','META_IG_ID'])
      .then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});
    if (!cfg.META_ACCESS_TOKEN || !cfg.META_PAGE_ID) return; // not connected
    // Only sync if IG ID is truly missing (empty string or null)
    if (cfg.META_IG_ID && cfg.META_IG_ID.length > 5) return; // already have valid ID

    // Fetch IG ID using saved page token or user token
    const token = cfg.META_PAGE_TOKEN || cfg.META_ACCESS_TOKEN;
    const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.META_PAGE_ID}?fields=instagram_business_account&access_token=${token}`);
    const data = await res.json();
    const igId = data.instagram_business_account?.id;
    if (igId && igId.length > 5) {
      await sb.from('marketing_settings').upsert({key:'META_IG_ID',value:igId},{onConflict:'key'});
      // Keep social_connections in sync
      await sb.from('social_connections').upsert([
        {platform:'instagram', status:'connected', access_token_set:true, updated_at:new Date().toISOString()},
        {platform:'facebook',  status:'connected', access_token_set:true, updated_at:new Date().toISOString()},
      ],{onConflict:'platform'}).then(()=>{}).catch(()=>{});
      console.log('[Meta] Instagram ID auto-synced:', igId);
    } else {
      console.log('[Meta] IG ID not found in this fetch — keeping existing value');
    }
  } catch(e) {
    console.log('[Meta] Auto-sync Instagram ID failed silently:', e.message);
  }
}

async function connectMeta() {
  const appId = (document.getElementById('meta-app-id')?.value||'').trim();
  const appSecret = (document.getElementById('meta-app-secret')?.value||'').trim();
  if (!appId || !appSecret) { showMktToast('Enter both App ID and App Secret'); return; }

  // Save credentials
  await sb.from('marketing_settings').upsert([
    { key: 'META_APP_ID', value: appId },
    { key: 'META_APP_SECRET', value: appSecret }
  ], { onConflict: 'key' });

  // Build OAuth URL
  const redirectUri = encodeURIComponent('https://vwholesale.in/marketing/');
  const scope = encodeURIComponent('pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,pages_show_list');
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=meta_oauth`;
  window.location.href = url;
}

async function handleMetaOAuth(code) {
  showMktToast('🔗 Completing Meta connection…');
  try {
    const { data: settings } = await sb.from('marketing_settings').select('key,value').in('key',['META_APP_ID','META_APP_SECRET']).then(r=>r,()=>({data:[]}));
    const cfg = {}; (settings||[]).forEach(s => { cfg[s.key] = s.value; });
    if (!cfg.META_APP_ID) { showMktToast('❌ Meta App ID not found — enter credentials first'); mktNav('integrations'); return; }

    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-oauth', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'exchange_code', code, app_id:cfg.META_APP_ID, app_secret:cfg.META_APP_SECRET||'' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Meta connection failed');

    const _now = new Date().toISOString();
    await sb.from('social_connections').upsert([
      {platform:'meta',      status:'connected', access_token_set:true, connected_at:_now, updated_at:_now},
      {platform:'instagram', status:'connected', access_token_set:true, connected_at:_now, updated_at:_now},
      {platform:'facebook',  status:'connected', access_token_set:true, connected_at:_now, updated_at:_now},
    ],{onConflict:'platform'});

    showMktToast('✅ Meta (Instagram + Facebook) connected!');
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
}

async function fetchMetaIgId() {
  const btn = document.querySelector('[onclick="fetchMetaIgId()"]');
  if (btn) { btn.textContent = '⏳ Syncing…'; btn.disabled = true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-setup', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'fetch_ig_id'})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    // Only update display — don't re-render entire page (which resets status)
    const el = document.getElementById('meta-status-detail');
    if (data.ig_id && data.ig_id !== 'not_found') {
      if (el) el.innerHTML = '✅ Connected · Page: V Wholesale · Instagram: @vwholesaleindia (ID: '+data.ig_id+')';
      showMktToast('✅ Instagram ID: '+data.ig_id);
    } else {
      if (el) el.innerHTML = '✅ Facebook Page connected · Instagram not linked yet — link @vwholesaleindia to V Wholesale page in Facebook Settings → Linked Accounts';
      showMktToast('⚠️ Instagram not linked to Facebook page yet');
    }
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '🔄 Sync Instagram ID'; btn.disabled = false; }
  }
}

async function disconnectMeta() {
  await sb.from('social_connections').update({status:'disconnected',access_token_set:false}).eq('platform','meta');
  await sb.from('marketing_settings').delete().in('key',['META_ACCESS_TOKEN','META_APP_ID','META_APP_SECRET','META_PAGE_ID','META_IG_ID']);
  showMktToast('Meta disconnected');
  renderIntegrations();
}

async function loadYouTubeStats() {
  const statsEl = document.getElementById('yt-stats-display');
  if (statsEl) statsEl.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Loading…</div>';
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value').in('key',['YOUTUBE_CHANNEL_ID','YOUTUBE_API_KEY']).then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${cfg.YOUTUBE_CHANNEL_ID}&key=${cfg.YOUTUBE_API_KEY}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const ch = data.items?.[0];
    if (!ch) throw new Error('Channel not found');
    const subs = parseInt(ch.statistics?.subscriberCount||0).toLocaleString('en-IN');
    const views = parseInt(ch.statistics?.viewCount||0).toLocaleString('en-IN');
    const videos = parseInt(ch.statistics?.videoCount||0);
    if (statsEl) statsEl.innerHTML = `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px;font-size:11px">
      <div style="font-weight:700;color:#22c55e;margin-bottom:6px">▶️ ${ch.snippet?.title}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${subs}</div><div style="color:var(--text3)">Subscribers</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${views}</div><div style="color:var(--text3)">Views</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${videos}</div><div style="color:var(--text3)">Videos</div></div>
      </div>
    </div>`;
  } catch(e) {
    if (statsEl) statsEl.innerHTML = `<div style="color:var(--red);font-size:11px">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  }
}

async function saveYouTubeSettings() {
  const apiKey = (document.getElementById('yt-api-key')?.value||'').trim();
  if (!apiKey) { showMktToast('Enter the API Key'); return; }
  // Channel ID is already saved — read from DB
  const { data: chRow } = await sb.from('marketing_settings').select('value').eq('key','YOUTUBE_CHANNEL_ID').maybeSingle().then(r=>r,()=>({data:null}));
  const channelId = chRow?.value || 'UCFQfukKHctvBn_cSqBL66zg';

  showMktToast('⏳ Verifying YouTube connection…');
  try {
    // Test the API key by fetching channel info
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.items?.length) throw new Error('Channel not found — check Channel ID');

    const channel = data.items[0];
    const name = channel.snippet?.title || 'Unknown';
    const subs = parseInt(channel.statistics?.subscriberCount||0).toLocaleString('en-IN');
    const views = parseInt(channel.statistics?.viewCount||0).toLocaleString('en-IN');

    // Save to DB
    await sb.from('marketing_settings').upsert([
      {key:'YOUTUBE_CHANNEL_ID', value:channelId},
      {key:'YOUTUBE_API_KEY', value:apiKey},
      {key:'YOUTUBE_CHANNEL_NAME', value:name},
      {key:'YOUTUBE_SUBSCRIBER_COUNT', value:subs},
      {key:'YOUTUBE_VIEW_COUNT', value:views},
    ],{onConflict:'key'});

    await sb.from('social_connections').upsert({
      platform:'youtube', status:'connected', access_token_set:true,
      connected_at:new Date().toISOString(), updated_at:new Date().toISOString()
    },{onConflict:'platform'});

    const badge = document.getElementById('yt-status-badge');
    if (badge) { badge.textContent='✅ Connected'; badge.className='badge badge-green'; }

    const statsEl = document.getElementById('yt-stats-display');
    if (statsEl) statsEl.innerHTML = `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px;font-size:11px">
      <div style="font-weight:700;color:#22c55e;margin-bottom:6px">✅ Connected — ${name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${subs}</div><div style="color:var(--text3)">Subscribers</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${views}</div><div style="color:var(--text3)">Total Views</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${parseInt(channel.statistics?.videoCount||0)}</div><div style="color:var(--text3)">Videos</div></div>
      </div>
    </div>`;
    showMktToast('✅ YouTube connected: '+name+' · '+subs+' subscribers');
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
}

async function setTrendSchedule(freq, btn) {
  await sb.from('marketing_settings').upsert([
    {key:'TREND_SCOUT_SCHEDULE', value:freq},
    {key:'TREND_SCOUT_NEXT_RUN', value:getTrendNextRun(freq)}
  ],{onConflict:'key'});
  const el = document.getElementById('trend-schedule-status');
  if (el) { el.textContent = freq; el.className = 'badge badge-green'; }
  showMktToast('✅ Trend Scout set to: '+freq+' — next run: '+new Date(getTrendNextRun(freq)).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}));
  document.querySelectorAll('[onclick*="setTrendSchedule"]').forEach(b => {
    b.classList.remove('mkt-btn-primary');
    b.classList.add('mkt-btn-ghost');
  });
  if (btn) { btn.classList.remove('mkt-btn-ghost'); btn.classList.add('mkt-btn-primary'); }
}

function getTrendNextRun(freq) {
  const now = Date.now();
  const intervals = {'Hourly':3600000,'Every 4h':14400000,'Twice daily':43200000,'Daily':86400000};
  return String(now + (intervals[freq]||86400000));
}

async function checkAndRunTrendScout() {
  // Called on portal load — runs trend scout if schedule says it's due
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value')
      .in('key',['TREND_SCOUT_SCHEDULE','TREND_SCOUT_NEXT_RUN','TREND_SCOUT_LAST_RUN']).then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});
    if (!cfg.TREND_SCOUT_SCHEDULE) return; // not scheduled
    const nextRun = parseInt(cfg.TREND_SCOUT_NEXT_RUN||'0');
    if (Date.now() < nextRun) return; // not time yet
    console.log('[Trend Scout] Auto-running — schedule:', cfg.TREND_SCOUT_SCHEDULE);
    // Run silently
    const res = await fetch(MKT_SB_URL+'/functions/v1/trend-scout',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:'{}'});
    const data = await res.json();
    // Set next run time
    await sb.from('marketing_settings').upsert([
      {key:'TREND_SCOUT_NEXT_RUN', value:getTrendNextRun(cfg.TREND_SCOUT_SCHEDULE)},
      {key:'TREND_SCOUT_LAST_RUN', value:String(Date.now())}
    ],{onConflict:'key'});
    if (data.alerted) showMktToast('🔥 Trend Scout found a trend! Check AI Agents.');
  } catch(e) { console.log('[Trend Scout] Auto-run error:', e.message); }
}


async function renderCommandCentre() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading your AI CMO briefing…</div>`);
  try {

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime()-86400000).toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const [
    {data: todayPosts},
    {data: monthPosts},
    {data: channelPosts},
    {data: calToday},
    {data: calMonth},
    {data: notifications},
    {data: ytSettings},
    {data: stratSessions}
  ] = await Promise.all([
    sb.from('content_posts').select('*').gte('created_at', yesterday+'T00:00:00').then(r=>r,()=>({data:[]})),
    sb.from('content_posts').select('id,post_type,status').gte('created_at', monthStart).then(r=>r,()=>({data:[]})),
    sb.from('channel_posts').select('channel,status').eq('status','published').gte('created_at', monthStart).then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('*').eq('cal_date', todayStr).then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('*').gte('cal_date', todayStr).order('cal_date',{ascending:true}).limit(30).then(r=>r,()=>({data:[]})),
    sb.from('agent_notifications').select('*').or('resolved.eq.false,resolved.is.null').eq('response','pending').order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]})),
    sb.from('marketing_settings').select('key,value').in('key',['YOUTUBE_SUBSCRIBER_COUNT','YOUTUBE_VIDEO_COUNT','META_IG_ID']).then(r=>r,()=>({data:[]})),
    sb.from('strategy_sessions').select('*').order('created_at',{ascending:false}).limit(1).then(r=>r,()=>({data:[]}))
  ]);

  const ytCfg = {}; (ytSettings||[]).forEach(r=>{ytCfg[r.key]=r.value;});
  const monthPublished = (channelPosts||[]).length;
  const pendingApprovals = (notifications||[]).length;
  const todayCalItems = calToday||[];
  const lastSession = (stratSessions||[])[0];
  const daysSinceSession = lastSession
    ? Math.floor((Date.now()-new Date(lastSession.created_at).getTime())/86400000)
    : 999;
  const daysSinceStrategy = daysSinceSession; // alias
  const sessionDue = daysSinceSession >= 12;
  const nextStrategyDate = getNextStrategyDate();

  // AI CMO suggestions based on data
  const suggestions = [];
  if (todayCalItems.length === 0) suggestions.push({icon:'📅', text:'No content planned for today — open Calendar to add a post', action:"mktNav('calendar')", urgent:true});
  if (pendingApprovals > 0) suggestions.push({icon:'✅', text:`${pendingApprovals} post${pendingApprovals>1?'s':''} waiting for your approval`, action:"mktNav('agents')", urgent:true});
  if (daysSinceStrategy >= 12) suggestions.push({icon:'🧠', text:'Strategy session overdue — plan your content for the next fortnight', action:"mktNav('calendar');setTimeout(openStrategySession,400)", urgent:true});
  if (monthPublished < 5) suggestions.push({icon:'📢', text:'Only '+monthPublished+' posts published this month — target is 15-20', action:"mktNav('calendar')", urgent:false});
  if (!ytCfg.META_IG_ID) suggestions.push({icon:'📸', text:'Instagram not connected — sync it in Integrations', action:"mktNav('integrations')", urgent:false});
  suggestions.push({icon:'🔥', text:'Run Trend Scout to find today\u2019s opportunities', action:"mktNav('agents')", urgent:false});
  suggestions.push({icon:'🎬', text:'Record a reel \u2014 your audience engages 3x more with video', action:"mktNav('calendar')", urgent:false});

  const todayDateStr = now.toLocaleDateString('en-IN',{weekday:'long', day:'numeric', month:'long', year:'numeric'});

  setContent(`
  <!-- CMO GREETING -->
  <div style="background:linear-gradient(135deg,#EEF2F7,#E8EDF5);border:1px solid rgba(201,168,76,.5);border-radius:14px;padding:20px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="font-size:36px">🤖</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:900;color:var(--text)">${greeting}, Himansu</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${todayDateStr}</div>
        <div style="font-size:12px;color:var(--gold);margin-top:6px;font-weight:600">
          ${monthPublished} posts published this month · ${(monthPosts||[]).length} created · ${pendingApprovals} pending approval
        </div>
      </div>
      <button onclick="generateCMOBriefing(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:8px 14px;flex-shrink:0">🧠 AI Briefing</button>
    </div>
    <div id="cmo-briefing-output" style="margin-top:0"></div>
  </div>

  <!-- STRATEGY SESSION BANNER IN CMO -->
  ${sessionDue ? `
  <div class="mkt-card" style="margin-bottom:14px;border-left:3px solid #ef4444;background:rgba(239,68,68,.04)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">🧠</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">Strategy Session Due
          <span class="badge badge-red" style="margin-left:8px">Overdue</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${lastSession
            ? `Last session was ${daysSinceSession} days ago · Next: ${nextStrategyDate}`
            : 'No sessions yet — plan your first content strategy'}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">
          📅 ${(calMonth||[]).length} posts planned ahead · ${(calMonth||[]).filter(c=>c.is_reel).length} reels · ${(calMonth||[]).filter(c=>!c.is_reel&&c.content_type!=='reel').length} other
        </div>
      </div>
      <button onclick="openStrategySession()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:8px 14px;flex-shrink:0">🧠 Start Session</button>
    </div>
  </div>` : `
  <div class="mkt-card" style="margin-bottom:14px;border-left:3px solid var(--gold);background:rgba(201,168,76,.04)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">🧠</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">Content Strategy Active</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${lastSession
            ? `Last session: ${new Date(lastSession.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · Next due: ${nextStrategyDate}`
            : 'No sessions yet'}
          ${lastSession?.summary ? ` · "${lastSession.summary.slice(0,60)}…"` : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">
          📅 <b>${(calMonth||[]).length}</b> posts planned · <b>${(calMonth||[]).filter(c=>c.is_reel).length}</b> reels · 
          Next: ${calMonth?.[0] ? new Date(calMonth[0].cal_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' — '+calMonth[0].topic : 'Nothing scheduled'}
        </div>
      </div>
      <button onclick="openStrategySession()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px;flex-shrink:0">💬 Update</button>
    </div>
  </div>`}

  <!-- TODAY'S PLAN -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📅 Today's Content</div>
      ${todayCalItems.length ? todayCalItems.map(item=>`
      <div style="padding:8px;background:var(--bg3);border-radius:6px;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">${cleanTopic(item.topic)||'Untitled'}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${item.content_type||'post'} · ${item.status||'planned'}</div>
        <div style="display:flex;gap:5px;margin-top:6px">
          ${item.is_reel
            ? `<button onclick="generateAndShowReelScript('${(item.topic||'').replace(/'/g,"\'")}','${item.id}',this)" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:3px 8px">🎬 Script</button>`
            : `<button onclick="quickCreateFromCalendar('${(item.topic||'').replace(/'/g,"\'")}','${item.content_type||'image'}','bilingual')" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:3px 8px">⚡ Create</button>`}
        </div>
      </div>`).join('')
      : `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">
          Nothing planned for today
          <button onclick="addCalendarItem()" class="mkt-btn mkt-btn-primary" style="display:block;margin:8px auto 0;font-size:11px;padding:6px 12px">+ Add Today</button>
        </div>`}
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📊 This Month</div>
      <div style="display:grid;gap:8px">
        ${[
          {label:'Posts Created', value:(monthPosts||[]).length, color:'var(--gold)'},
          {label:'Published', value:monthPublished, color:'#22c55e'},
          {label:'Reels', value:(monthPosts||[]).filter(p=>p.post_type==='reel').length, color:'#a855f7'},
          {label:'Pending Approval', value:pendingApprovals, color:pendingApprovals>0?'#f59e0b':'var(--text3)'},
        ].map(m=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px">
          <div style="font-size:11px;color:var(--text2)">${m.label}</div>
          <div style="font-size:16px;font-weight:700;color:${m.color}">${m.value}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- AI SUGGESTIONS -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">💡 AI Suggestions for Today</div>
    <div style="display:grid;gap:8px">
      ${suggestions.map(s=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:${s.urgent?'rgba(201,168,76,.06)':'var(--bg3)'};border:1px solid ${s.urgent?'rgba(201,168,76,.2)':'var(--border)'};border-radius:8px;cursor:pointer" onclick="${s.action}">
        <span style="font-size:20px;flex-shrink:0">${s.icon}</span>
        <div style="flex:1;font-size:12px;color:var(--text2)">${s.text}</div>
        <span style="font-size:16px;color:var(--text3)">›</span>
      </div>`).join('')}
    </div>
  </div>

  <!-- QUICK ACTIONS -->
  <div style="font-size:12px;font-weight:700;margin-bottom:10px">⚡ Quick Actions</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;max-height:300px;overflow-y:auto">
    ${[
      {icon:'📅', label:'Calendar', page:'calendar'},
      {icon:'🤖', label:'AI Agents', page:'agents'},
      {icon:'📸', label:'Create Post', page:'content'},
      {icon:'🖼️', label:'AI Photoshoot', fn:'openAIPhotoshoot()'},
      {icon:'📢', label:'Boost Post', page:'ads'},
      {icon:'📊', label:'Analytics', page:'analytics'},
      {icon:'🔌', label:'Integrations', page:'integrations'},
      {icon:'🔥', label:'Trend Scout', fn:"mktNav('agents');setTimeout(()=>runTrendScout(),400)"},
      {icon:'💬', label:'WhatsApp', fn:"generateWhatsAppBroadcast()"},
      {icon:'⭐', label:'Review Reply', fn:"generateReviewReply()"},
      {icon:'👷', label:'Contractor Kit', fn:"generateContractorContent()"},
      {icon:'🏷️', label:'Hashtags', fn:"generateHashtags(prompt('Topic for hashtags:')||'home renovation')"},
      {icon:'🧪', label:'A/B Variants', fn:"generateABVariants(prompt('Topic:')||'tiles',prompt('Format:')||'Instagram post')"},
      {icon:'🚀', label:'Bulk Generate', fn:"bulkGenerateMonth()"},
    ].map(a=>`
    <button onclick="${a.fn||"mktNav('"+a.page+"')"}" class="mkt-btn mkt-btn-ghost" style="flex-direction:column;align-items:center;padding:12px 6px;gap:6px;display:flex;font-size:11px;height:70px">
      <span style="font-size:22px">${a.icon}</span>
      <span style="color:var(--text2)">${a.label}</span>
    </button>`).join('')}
  </div>

  <!-- BUSINESS INTELLIGENCE STRIP -->
  <div class="mkt-card" id="bi-strip" style="margin-bottom:0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700">📊 Business Intelligence</div>
      <div style="display:flex;gap:6px">
        <button onclick="mktNav('bi')" style="background:none;border:none;color:var(--gold);font-size:10px;cursor:pointer;font-weight:700">View Full →</button>
        <button onclick="loadBIStrip()" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer">↻</button>
      </div>
    </div>
    <div id="bi-strip-content" style="font-size:11px;color:var(--text3)">Loading…</div>
  </div>

  <!-- CHANNEL STATUS -->
  <div class="mkt-card">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔌 Channel Status</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[
        {icon:'📍', name:'GBP', status:'Quota pending', color:'#f59e0b'},
        {icon:'📸', name:'Instagram', status:'Connected', color:'#22c55e'},
        {icon:'👤', name:'Facebook', status:'Connected', color:'#22c55e'},
        {icon:'🧵', name:'Threads', status:'Connected', color:'#22c55e'},
        {icon:'▶️', name:'YouTube', status:'Connected', color:'#22c55e'},
        {icon:'💬', name:'WhatsApp', status:'Connected', color:'#22c55e'},
      ].map(c=>`
      <div style="text-align:center;padding:8px;background:var(--bg3);border-radius:8px">
        <div style="font-size:18px">${c.icon}</div>
        <div style="font-size:11px;font-weight:600;margin-top:2px">${c.name}</div>
        <div style="font-size:9px;color:${c.color};margin-top:2px">${c.status}</div>
      </div>`).join('')}
    </div>
  </div>`);
  // Load BI strip async after render
  setTimeout(loadBIStrip, 300);
  } catch(e) {
    console.error('renderCommandCentre error:', e);
    setContent(`<div style="text-align:center;padding:40px;color:#ef4444">❌ Command Centre failed to load: ${e.message}<br><br><button onclick="renderCommandCentre()" class="mkt-btn mkt-btn-primary">Retry</button></div>`);
  }
}

async function loadBIStrip() {
  const el = document.getElementById('bi-strip-content');
  if (!el) return;
  el.innerHTML = '<span style="color:var(--text3)">Loading intelligence…</span>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/business-intelligence',{
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY}
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const s = data.snapshot;
    const momArrow = s.revenue.mom_change_pct >= 0 ? '↑' : '↓';
    const momColor = s.revenue.mom_change_pct >= 0 ? '#22c55e' : '#ef4444';
    const hotStage = s.hot_leads?.[0];
    const topCat = s.top_categories?.[0];
    const slowCat = s.slow_movers?.[0];

    el.innerHTML = `
      <!-- Revenue row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:900;color:var(--gold)">₹${s.revenue.this_month_lakhs}L</div>
          <div style="font-size:9px;color:var(--text3)">This month</div>
        </div>
        <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:900;color:var(--text2)">₹${s.revenue.last_month_lakhs}L</div>
          <div style="font-size:9px;color:var(--text3)">Last month</div>
        </div>
        <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:900;color:${momColor}">${momArrow}${Math.abs(s.revenue.mom_change_pct)}%</div>
          <div style="font-size:9px;color:var(--text3)">MoM</div>
        </div>
      </div>

      <!-- Key signals row -->
      <div style="display:grid;gap:6px">
        ${hotStage ? `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(201,168,76,.08);border-radius:8px;padding:8px;border-left:3px solid var(--gold)">
          <div style="font-size:16px">🔥</div>
          <div>
            <div style="font-weight:700;color:var(--gold);font-size:11px">Immediate opportunity</div>
            <div style="color:var(--text2);font-size:11px">${hotStage.reachable} reachable customers → ready to buy <b>${hotStage.next_buy}</b></div>
          </div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${topCat ? `
          <div style="background:var(--bg2);border-radius:8px;padding:8px">
            <div style="font-size:9px;color:#22c55e;font-weight:700;margin-bottom:3px">🏆 TOP SELLER</div>
            <div style="font-size:12px;font-weight:700">${topCat.category}</div>
            <div style="font-size:10px;color:var(--text3)">₹${topCat.revenue_lakhs}L · ${topCat.unique_customers} customers</div>
          </div>` : ''}
          ${slowCat ? `
          <div style="background:var(--bg2);border-radius:8px;padding:8px">
            <div style="font-size:9px;color:#f59e0b;font-weight:700;margin-bottom:3px">⚠️ NEEDS PUSH</div>
            <div style="font-size:12px;font-weight:700">${slowCat}</div>
            <div style="font-size:10px;color:var(--text3)">Low sales — content can help</div>
          </div>` : ''}
        </div>
        <!-- Pipeline summary -->
        <div style="background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:9px;color:var(--text3);font-weight:700;margin-bottom:5px">👥 PIPELINE — reachable customers by stage</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${(s.customer_pipeline||[]).filter(p=>p.reachable>0).slice(0,6).map(p=>`
            <div style="background:var(--bg3);border-radius:5px;padding:3px 7px;text-align:center">
              <div style="font-size:12px;font-weight:700;color:var(--gold)">${p.reachable}</div>
              <div style="font-size:8px;color:var(--text3)">${p.stage.replace('_',' ')}</div>
            </div>`).join('')}
          </div>
        </div>
        <!-- Field visits -->
        ${s.field_intelligence?.total_visits > 0 ? `
        <div style="background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:9px;color:#3b82f6;font-weight:700;margin-bottom:3px">🏗️ FIELD INTELLIGENCE</div>
          <div style="font-size:11px;color:var(--text2)">${s.field_intelligence.total_visits.toLocaleString()} sites visited · ${s.field_intelligence.valid_phone.toLocaleString()} with contact</div>
        </div>` : ''}
      </div>
      <div style="font-size:9px;color:var(--text3);margin-top:8px;text-align:right">Updated ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>`;
  } catch(e) {
    if (el) el.innerHTML = `<span style="color:var(--red)">⚠️ Could not load — ${e.message}</span>`;
  }
}

async function generateCMOBriefing(btn) {
  if (btn) { btn.textContent='⏳ Thinking…'; btn.disabled=true; }
  const out = document.getElementById('cmo-briefing-output');
  if (out) out.innerHTML='';

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      {data: posts},
      {data: cal},
      {data: sessions}
    ] = await Promise.all([
      sb.from('content_posts').select('topic,post_type,status').gte('created_at', monthStart).then(r=>r,()=>({data:[]})),
      sb.from('content_calendar').select('topic,content_type,cal_date,status').gte('cal_date', now.toISOString().split('T')[0]).limit(7).then(r=>r,()=>({data:[]})),
      sb.from('strategy_sessions').select('summary,key_themes').order('created_at',{ascending:false}).limit(1).then(r=>r,()=>({data:[]}))
    ]);

    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'AI CMO',
        prompt: `You are the AI CMO for V Wholesale, Vijayawada — India's premium home building materials store.

Today: ${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
Month: ${now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
Posts this month: ${(posts||[]).length} created, ${(posts||[]).filter(p=>p.status==='published').length} published
Upcoming calendar: ${(cal||[]).map(c=>`${new Date(c.cal_date).getDate()} ${c.topic}`).join(', ')||'empty'}
Last strategy: ${(sessions||[])[0]?.summary?.slice(0,100)||'none'}

Write a short, sharp AI CMO morning briefing for Himansu. Like a real CMO would:
- What worked yesterday (infer from data)
- Top 2-3 priorities for today
- One bold suggestion
- Keep it under 80 words, conversational, direct

Return as plain text, no JSON.`,
        context: {}
      })
    });
    const data = await res.json();
    const briefing = typeof data.output === 'string' ? data.output : (data.output?.message || data.output?.master_text || 'Ready to help you grow V Wholesale today.');

    if (out) out.innerHTML = `<div style="margin-top:14px;padding:12px;background:var(--bg3);border-radius:8px;font-size:12px;color:var(--text2);line-height:1.8;border-left:3px solid var(--gold)">${briefing}</div>`;
  } catch(e) {
    if (out) out.innerHTML = `<div style="margin-top:10px;font-size:11px;color:var(--text3)">Briefing unavailable — ${e.message}</div>`;
  } finally {
    if (btn) { btn.textContent='🧠 AI Briefing'; btn.disabled=false; }
  }
}


async function renderAICMO() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading your CMO brief…</div>`);

  // Pull live data for context
  const [
    {data:campaigns}, {data:posters}, {data:calItems},
    {data:blogs}, {data:competitors}, {data:feedPosts}
  ] = await Promise.all([
    sb.from('campaigns').select('name,status,spent_inr,budget_inr,conversions').eq('status','active').then(r=>r,()=>({data:[]})),
    sb.from('poster_history').select('created_at').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('status,cal_date').gte('cal_date', new Date().toISOString().split('T')[0]).lte('cal_date', new Date(Date.now()+7*86400000).toISOString().split('T')[0]).then(r=>r,()=>({data:[]})),
    sb.from('blog_posts').select('status').then(r=>r,()=>({data:[]})),
    sb.from('competitors').select('id').then(r=>r,()=>({data:[]})),
    sb.from('daily_posts_feed').select('created_at').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]}))
  ]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">🤖 AI CMO — Weekly Marketing Brief</h3>
    <div style="font-size:12px;color:var(--text3)">${dateStr}</div>
  </div>

  <!-- Status snapshot -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    ${[
      {icon:'📣',label:'Active Campaigns',val:(campaigns||[]).length,color:'#22c55e'},
      {icon:'🎨',label:'Posters This Week',val:(posters||[]).length,color:'var(--gold)'},
      {icon:'📢',label:'Posts to Staff',val:(feedPosts||[]).length,color:'#3b82f6'}
    ].map(m=>'<div class="mkt-card" style="padding:10px;text-align:center">'
      +'<div style="font-size:20px">'+m.icon+'</div>'
      +'<div style="font-size:18px;font-weight:900;color:'+m.color+'">'+m.val+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.label+'</div>'
    +'</div>').join('')}
  </div>

  <!-- AI Weekly Brief -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,#c9a84c,#f59e0b);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">🤖</div>
      <div>
        <div style="font-size:14px;font-weight:900">Your AI Chief Marketing Officer</div>
        <div style="font-size:11px;color:var(--text3)">Get a personalised weekly marketing plan based on your actual data</div>
      </div>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">What's happening this week? (optional)</label>
      <input id="cmo-context" class="mkt-form-input" placeholder="e.g. Pushing Italian marble, Ganesh Chaturthi coming up, sales slow on Tuesdays">
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="generateCMOBrief()" style="width:100%;padding:14px;font-size:14px;font-weight:900">🧠 Generate This Week's Marketing Plan</button>
    <div id="cmo-output" style="display:none;margin-top:14px">
      <div style="background:var(--bg3);border-radius:10px;padding:16px">
        <div id="cmo-content" style="font-size:13px;line-height:1.8;white-space:pre-wrap;color:var(--text1)"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="mkt-btn mkt-btn-ghost" onclick="copyText('cmo-content')" style="flex:1">📋 Copy Brief</button>
        <button class="mkt-btn mkt-btn-primary" onclick="generateCMOBrief()" style="flex:1">🔄 Regenerate</button>
      </div>
    </div>
  </div>

  <!-- Weekly content schedule -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📅 This Week's Content Plan</div>
    <div style="display:grid;gap:6px">
      ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i) => {
        const d = new Date(today);
        const diff = i - today.getDay();
        d.setDate(today.getDate() + diff);
        const dateStr = d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
        const isToday = d.toDateString() === today.toDateString();
        const isPast = d < today && !isToday;
        const calDay = (calItems||[]).filter(c=>c.cal_date===d.toISOString().split('T')[0]);
        const postTypes = {
          'Monday':'🏠 Project Proof — before/after tile installation',
          'Wednesday':'📦 Product Spotlight — feature a brand or new arrival',
          'Friday':'🏗️ Contractor Club — recruit contractors, mention 2% bonus',
          'Saturday':'⭐ Customer Story — testimonial or review',
          'Tuesday':'',
          'Thursday':'',
          'Sunday':''
        };
        const hint = postTypes[day];
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:'+(isToday?'rgba(201,168,76,0.08)':'var(--bg3)')+';border-radius:8px;border:'+(isToday?'1px solid rgba(201,168,76,0.3)':'1px solid transparent')+'">'
          +'<div style="min-width:32px;text-align:center"><div style="font-size:11px;font-weight:700;color:'+(isToday?'var(--gold)':isPast?'var(--text3)':'var(--text2)')+'">'+day.slice(0,3)+'</div>'
          +'<div style="font-size:10px;color:var(--text3)">'+dateStr+'</div></div>'
          +'<div style="flex:1"><div style="font-size:11px;color:'+(isPast?'var(--text3)':'var(--text1)')+';">'
          +(calDay.length?'📌 '+calDay.length+' item(s) planned':hint?hint:'<span style="color:var(--text3)">No content planned</span>')+'</div></div>'
          +(isToday?'<span class="badge badge-green" style="font-size:9px">TODAY</span>':'')
        +'</div>';
      }).join('')}
    </div>
  </div>

  <!-- Quick actions -->
  <div class="mkt-card">
    <div class="mkt-card-title">⚡ Act on AI Recommendations</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${[
        {label:"Generate Today's Poster",icon:'🎨',page:'poster'},
        {label:'Write Blog Article',icon:'📝',page:'website-seo'},
        {label:'Plan Calendar',icon:'📅',page:'calendar'},
        {label:'Send WhatsApp',icon:'💬',page:'whatsapp'},
        {label:'Check Competitors',icon:'🔍',page:'competitors'},
        {label:'View Analytics',icon:'📊',page:'analytics'}
      ].map(a=>'<button class="mkt-btn mkt-btn-ghost" onclick="mktNav(\''+a.page+'\');" style="display:flex;align-items:center;gap:8px;padding:10px;font-size:12px;font-weight:600">'
        +'<span style="font-size:18px">'+a.icon+'</span>'+a.label+'</button>'
      ).join('')}
    </div>
  </div>`);
}

async function generateCMOBrief() {
  const context = (document.getElementById('cmo-context')?.value||'').trim();
  const btn = document.querySelector('[onclick="generateCMOBrief()"]');
  if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }

  const [
    {data:campaigns}, {data:posters7}, {data:blogs},
    {data:competitors}, {data:calItems}, {data:greetings7}
  ] = await Promise.all([
    sb.from('campaigns').select('name,status,spent_inr,budget_inr,impressions,conversions').then(r=>r,()=>({data:[]})),
    sb.from('poster_history').select('topic,template,created_at').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]})),
    sb.from('blog_posts').select('title,status').then(r=>r,()=>({data:[]})),
    sb.from('competitors').select('name').then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('topic,status,cal_date,is_reel').gte('cal_date', new Date().toISOString().split('T')[0]).lte('cal_date', new Date(Date.now()+7*86400000).toISOString().split('T')[0]).then(r=>r,()=>({data:[]})),
    sb.from('greeting_log').select('person_name,greeting_type').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]}))
  ]);

  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-IN',{weekday:'long'});

  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'cmo_weekly_brief', language:'en',
      topic:'Weekly marketing brief',
      context:{
        business:'V Wholesale', location:'Vijayawada, Andhra Pradesh',
        today: today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}),
        day_of_week: dayOfWeek,
        active_campaigns: (campaigns||[]).filter(c=>c.status==='active').map(c=>c.name),
        posters_this_week: (posters7||[]).length,
        upcoming_calendar: (calItems||[]).map(c=>c.topic||c.cal_date),
        blog_count: {published:(blogs||[]).filter(b=>b.status==='published').length, draft:(blogs||[]).filter(b=>b.status==='draft').length},
        competitors_tracked: (competitors||[]).map(c=>c.name),
        greetings_sent: (greetings7||[]).length,
        extra_context: context || 'none'
      }
    })
  });

  const data = await res.json();
  const content = data.content||data.text||'';

  const out = document.getElementById('cmo-output');
  const cont = document.getElementById('cmo-content');
  if (out) out.style.display='block';
  if (cont) cont.textContent = content || 'No brief generated — try again';

  if (btn) { btn.textContent = "🧠 Generate This Week's Marketing Plan"; btn.disabled = false; }
}

function copyText(id) {
  const el = document.getElementById(id);
  if (el) navigator.clipboard.writeText(el.textContent||'').then(()=>showMktToast('📋 Copied!'));
}

async function runAICMO() {
  if (aiPaused) { alert('AI actions are paused. Resume first.'); return; }

  const outputEl = document.getElementById('cmo-output');
  if (outputEl) {
    outputEl.innerHTML = `<div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div><span style="font-size:12px;color:var(--text3);margin-left:8px">AI CMO is analysing your business data…</span></div>`;
  }

  // Gather business context
  const [products, campaigns, integrations] = await Promise.all([
    sb.from('products').select('id,name,category,stock,price').limit(20).then(r=>r.data||[], ()=>[]),
    sb.from('marketing_campaigns').select('*').limit(5).then(r=>r.data||[], ()=>[]),
    sb.from('marketing_integrations').select('name,status').then(r=>r.data||[], ()=>[]),
  ]);

  const context = {
    business: 'V Wholesale — Omnichannel home building store, Vijayawada, Andhra Pradesh',
    website: 'https://vwholesale.in (just launched)',
    monthly_budget_inr: 30000,
    primary_goals: ['Store walk-ins', 'Quotations', 'GBP visibility', 'Contractor Club growth'],
    priority_channels: ['Website SEO', 'Google Business Profile', 'WhatsApp', 'Instagram', 'Reels'],
    languages: ['Telugu (primary)', 'English', 'Hindi'],
    target_locations: ['Vijayawada', 'Guntur', 'Mangalagiri', 'Tenali', 'Eluru'],
    product_categories: ['Tiles', 'Sanitaryware', 'Granite', 'Paints', 'Electricals', 'Plumbing'],
    total_products: products.length,
    integrations_status: integrations,
    active_campaigns: campaigns.length,
    date: new Date().toLocaleDateString('en-IN'),
  };

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'weekly_briefing',
        agent: 'AI CMO',
        model: 'gpt-4o-mini',
        prompt: `You are the AI CMO for V Wholesale, a home building superstore in Vijayawada, Andhra Pradesh.

Your role: Analyse current business context and produce a structured weekly marketing briefing.

STRICT RULES:
- Only recommend actions based on facts provided
- Never invent data, sales figures, or customer testimonials
- Always specify approval level needed (recommend/draft/approve/auto)
- Focus on local Vijayawada market
- Prioritise Telugu language content for local channels

Respond ONLY in this JSON format:
{
  "summary": "2-3 sentence overview of current marketing situation",
  "top_priorities": ["priority 1", "priority 2", "priority 3"],
  "weekly_actions": [
    {"action": "action description", "channel": "channel name", "effort": "low/medium/high", "impact": "low/medium/high", "approval": "auto/draft/approve", "reason": "why this matters"}
  ],
  "content_ideas": [
    {"type": "post/reel/story", "platform": "Instagram/GBP/WhatsApp", "topic": "topic", "language": "en/te/hi", "hook": "opening line idea"}
  ],
  "risks": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "budget_recommendation": {"gbp_boost": 0, "meta_ads": 0, "google_ads": 0, "reason": "rationale"}
}`,
        context
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const output = data.output;
    if (outputEl) {
      outputEl.innerHTML = `
      <div style="display:grid;gap:12px">

        <div class="ai-message ai">
          <div style="font-size:10px;font-weight:700;color:var(--purple);margin-bottom:6px">🧠 AI CMO WEEKLY BRIEFING · ${new Date().toLocaleDateString('en-IN')}</div>
          <div style="font-size:13px;line-height:1.7">${output.summary || 'Analysis complete.'}</div>
        </div>

        <div class="mkt-grid-2">
          <div class="mkt-card" style="margin:0">
            <div class="mkt-card-title">🎯 Top Priorities</div>
            ${(output.top_priorities||[]).map((p,i) => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--purple);font-weight:800">${i+1}</span>${p}</div>`).join('')}
          </div>
          <div class="mkt-card" style="margin:0">
            <div class="mkt-card-title">💡 Opportunities</div>
            ${(output.opportunities||[]).map(o => `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--border)">• ${o}</div>`).join('')}
            <div class="mkt-card-title" style="margin-top:12px">⚠️ Risks</div>
            ${(output.risks||[]).map(r => `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);color:var(--red)">• ${r}</div>`).join('')}
          </div>
        </div>

        <div class="mkt-card" style="margin:0">
          <div class="mkt-card-title">📋 This Week's Actions</div>
          <div style="display:grid;gap:8px">
            ${(output.weekly_actions||[]).map(a => `
            <div style="display:flex;gap:12px;align-items:flex-start;padding:10px;background:var(--bg3);border-radius:8px">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700">${a.action}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px">${a.channel} · ${a.reason}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                <span class="badge badge-blue">${a.impact} impact</span>
                <span class="badge ${a.approval==='auto'?'badge-green':a.approval==='draft'?'badge-blue':'badge-gold'}">${a.approval}</span>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div class="mkt-card" style="margin:0">
          <div class="mkt-card-title">💡 Content Ideas This Week</div>
          <div style="display:grid;gap:6px">
            ${(output.content_ideas||[]).map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:8px">
              <span class="badge badge-purple">${c.platform}</span>
              <span class="badge badge-gray">${c.type}</span>
              <span class="badge ${c.language==='te'?'badge-gold':c.language==='hi'?'badge-blue':'badge-gray'}">${c.language}</span>
              <div style="flex:1;font-size:12px"><strong>${c.topic}</strong> — "${c.hook}"</div>
              <button class="mkt-btn mkt-btn-ghost" onclick="draftContent('${c.type}','${c.platform}','${c.topic.replace(/'/g,"\\'")}','${c.language}')" style="font-size:10px;padding:4px 8px">Draft →</button>
            </div>`).join('')}
          </div>
        </div>

        <div style="font-size:10px;color:var(--text3);text-align:center;padding:8px">
          Generated by AI CMO · ${data.model} · $${(data.cost_usd||0).toFixed(4)} · ${data.duration_ms}ms
        </div>
      </div>`;
    }

  } catch(e) {
    if (outputEl) outputEl.innerHTML = `<div style="color:var(--red);padding:16px;text-align:center">
      <div style="font-size:20px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:700">AI CMO Error</div>
      <div style="font-size:12px;margin-top:4px">${e.message}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px">Make sure OpenAI API key is set in Supabase Edge Function secrets</div>
    </div>`;
  }
}

// ── CONTENT STUDIO ──
async function renderContentStudio() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading studio…</div>`);

  // Load brand profile + upcoming calendar + recent learning
  const [
    {data: bp},
    {data: calItems},
    {data: learning}
  ] = await Promise.all([
    sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null})),
    sb.from('content_calendar').select('*').gte('cal_date', new Date().toISOString().split('T')[0]).in('status',['planned','scripted']).order('cal_date',{ascending:true}).limit(10).then(r=>r,()=>({data:[]})),
    sb.from('ai_learning_log').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]}))
  ]);

  const CHANNELS = [
    {id:'gbp',          label:'📍 GBP',              size:'1:1',      auto:true},
    {id:'instagram_feed',label:'📸 Instagram Feed',  size:'1:1/4:5',  auto:false},
    {id:'instagram_story',label:'📱 Instagram Story',size:'9:16',     auto:false},
    {id:'facebook_post', label:'👤 Facebook Post',   size:'1.91:1',   auto:false},
    {id:'facebook_story',label:'📖 Facebook Story',  size:'9:16',     auto:false},
    {id:'whatsapp_bc',   label:'💬 WhatsApp Broadcast',size:'1:1',    auto:false},
    {id:'whatsapp_status',label:'💚 WA Status',      size:'9:16',     auto:false},
    {id:'threads',       label:'🧵 Threads',          size:'1:1',     auto:false},
    {id:'x',             label:'𝕏 X / Twitter',      size:'16:9',    auto:false},
    {id:'youtube',       label:'▶️ YouTube',          size:'16:9',    auto:false},
  ];

  const POST_TYPES = [
    {id:'image',    label:'🖼️ Image post'},
    {id:'reel',     label:'🎬 Reel (manual record)'},
    {id:'gif',      label:'✨ GIF / Motion'},
    {id:'festival', label:'🎉 Festival / Occasion'},
    {id:'qa',       label:'❓ Tip / Q&A carousel'},
  ];

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">✍️ Content Studio</h3>
      <div style="font-size:12px;color:var(--text3)">One brief → all channels. AI writes, you approve.</div>
    </div>
  </div>

  <!-- STEP 1: What are we creating? -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Step 1 — What are we creating?</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">Topic / Campaign</label>
        <input id="cs-topic" class="mkt-form-input"
          value="${(calItems||[])[0]?.topic||''}"
          placeholder="e.g. Italian marble new collection, Diwali offer, Kajaria tiles">
        ${(calItems||[]).length ? `<div style="font-size:10px;color:var(--gold);margin-top:3px">📅 Next from calendar: ${(calItems||[])[0]?.cal_date} — ${(calItems||[])[0]?.topic}</div>` : ''}
      </div>
      <div>
        <label class="mkt-form-label">Post type</label>
        <select id="cs-type" class="mkt-form-select" onchange="csTypeChanged(this.value)">
          ${POST_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Language selector -->
    <div style="margin-bottom:10px">
      <label class="mkt-form-label">Language</label>
      <div style="display:flex;gap:6px">
        ${[
          {id:'bilingual', label:'🇮🇳 Bilingual (Telugu headline + English body)', default:true},
          {id:'te',        label:'తెలుగు Telugu'},
          {id:'en',        label:'🇬🇧 English'},
        ].map(l=>`
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:11px;flex:1">
            <input type="radio" name="cs-lang" value="${l.id}" ${l.default?'checked':''} style="accent-color:var(--gold)">
            ${l.label}
          </label>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">💡 Bilingual recommended — Telugu stops the scroll, English boosts SEO. Festival posts auto-switch to Telugu.</div>
    </div>

    <!-- Channel selection -->
    <div>
      <label class="mkt-form-label">Publish to channels</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px">
        ${CHANNELS.map(c=>`
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:11px">
            <input type="checkbox" name="cs-channel" value="${c.id}" ${c.id==='gbp'?'checked':''} style="accent-color:var(--gold)">
            <span style="flex:1">${c.label}</span>
            <span style="font-size:9px;color:var(--text3)">${c.size}</span>
          </label>`).join('')}
      </div>
    </div>
  </div>

  <!-- Reel-specific: shown only for reel type -->
  <div id="cs-reel-section" style="display:none" class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Reel brief (AI prepares, you record)</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.7">
      After creating, you'll get:<br>
      • Hook line (first 3 seconds to stop scroll)<br>
      • Shot list (what to film, scene by scene)<br>
      • On-screen text for each scene<br>
      • Voiceover script (optional)<br>
      • Caption with hashtags + SEO keywords
    </div>
  </div>

  <!-- GIF section -->
  <div id="cs-gif-section" style="display:none" class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">GIF / Motion style</div>
    <div style="display:grid;gap:6px">
      ${[
        {id:'before_after', label:'Before / After reveal', desc:'Upload 2 photos — AI creates wipe animation'},
        {id:'product_loop', label:'Product showcase loop', desc:'AI generates product images and animates as carousel'},
        {id:'text_reveal',  label:'Text reveal animation', desc:'Animated text card — great for WhatsApp status'},
      ].map(g=>`
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
          <input type="radio" name="cs-gif" value="${g.id}" ${g.id==='before_after'?'checked':''} style="accent-color:var(--gold)">
          <div><div style="font-size:12px;font-weight:600">${g.label}</div><div style="font-size:11px;color:var(--text3)">${g.desc}</div></div>
        </label>`).join('')}
    </div>
    <div style="margin-top:8px">
      <label class="mkt-form-label">Upload before photo (for before/after)</label>
      <input type="file" id="cs-before-img" accept="image/*" class="mkt-form-input" style="padding:4px">
      <label class="mkt-form-label" style="margin-top:6px">Upload after photo</label>
      <input type="file" id="cs-after-img" accept="image/*" class="mkt-form-input" style="padding:4px">
    </div>
  </div>

  <!-- CREATE BUTTON -->
  <button id="cs-create-btn" class="mkt-btn mkt-btn-primary" onclick="createUnifiedContent()"
    style="width:100%;padding:16px;font-size:15px;font-weight:900;letter-spacing:.3px;margin-bottom:12px">
    ✨ Create Content for All Channels
  </button>

  <!-- PROGRESS -->
  <div id="cs-progress" style="display:none;margin-bottom:12px" class="mkt-card">
    <div id="cs-steps" style="display:grid;gap:6px"></div>
  </div>

  <!-- OUTPUT -->
  <div id="cs-output" style="display:none">

    <!-- Master content -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Master content</div>
        <div style="display:flex;gap:6px">
          <button onclick="csRegenContent()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Regenerate</button>
          <button onclick="csCopyMaster()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">📋 Copy</button>
        </div>
      </div>
      <textarea id="cs-master-text" class="mkt-form-input" rows="7" style="font-size:13px;line-height:1.8;resize:vertical"></textarea>
      <div id="cs-seo-keywords" style="margin-top:8px;display:none">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">SEO KEYWORDS</div>
        <div id="cs-kw-pills" style="display:flex;flex-wrap:wrap;gap:4px"></div>
      </div>
    </div>

    <!-- Reel script (shown for reel type) -->
    <div id="cs-reel-output" style="display:none" class="mkt-card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">🎬 Reel script & shot list</div>
      <div id="cs-reel-content" style="font-size:12px;line-height:1.9;white-space:pre-wrap;color:var(--text1)"></div>
    </div>

    <!-- Image section -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Visuals</div>
        <div style="display:flex;gap:6px">
          <button onclick="csRegenImage()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 New images</button>
          <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px;cursor:pointer;margin:0">
            📁 Upload <input type="file" id="cs-img-upload" accept="image/*" onchange="csHandleUpload(this)" style="display:none">
          </label>
        </div>
      </div>
      <div id="cs-image-variations" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"></div>
      <div id="cs-selected-image" style="display:none;border-radius:8px;overflow:hidden;border:2px solid var(--gold)">
        <img id="cs-selected-img" src="" style="width:100%;max-height:220px;object-fit:cover;display:block;cursor:zoom-in" onclick="openGBPImageFullscreen(this.src)">
        <div style="background:rgba(0,0,0,.6);padding:6px 10px;display:flex;justify-content:space-between">
          <span id="cs-img-label" style="font-size:10px;color:#fff"></span>
          <button onclick="openGBPImageFullscreen(document.getElementById('cs-selected-img').src)" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">⛶ Fullscreen</button>
        </div>
      </div>
      <input type="hidden" id="cs-image-url">
    </div>

    <!-- Channel adaptations -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Channel versions <span style="font-size:11px;color:var(--text3);font-weight:400">— tap to expand</span></div>
      <div id="cs-channel-versions" style="display:grid;gap:6px"></div>
    </div>

    <!-- Approve + Publish -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div id="cs-verify-result" style="margin-bottom:10px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <button class="mkt-btn mkt-btn-ghost" onclick="csVerify()" style="padding:12px;font-weight:700">🔍 Verify</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="csSendForApproval()" style="padding:12px;font-weight:700">📲 Send for Approval</button>
        <button class="mkt-btn mkt-btn-primary" onclick="csPublishAll()" style="padding:12px;font-weight:700">🚀 Publish All</button>
      </div>
    </div>
  </div>`);
}

function csTypeChanged(type) {
  document.getElementById('cs-reel-section').style.display = type === 'reel' ? 'block' : 'none';
  document.getElementById('cs-gif-section').style.display = type === 'gif' ? 'block' : 'none';
  if (type === 'festival') {
    // Auto-switch to Telugu for festivals
    const teRadio = document.querySelector('input[name="cs-lang"][value="te"]');
    if (teRadio) teRadio.checked = true;
    showMktToast('🎉 Festival post — switched to Telugu automatically');
  }
}

function csStep(idx, status, msg) {
  window._csSteps = window._csSteps || {};
  window._csSteps[idx] = {status, msg};
  const el = document.getElementById('cs-steps');
  if (!el) return;
  const icons = {pending:'⏳', done:'✅', error:'❌'};
  el.innerHTML = Object.values(window._csSteps).map(s =>
    `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:${s.status==='done'?'var(--green)':s.status==='error'?'var(--red)':'var(--text2)'}">
      <span>${icons[s.status]||'⏳'}</span><span>${s.msg}</span>
    </div>`).join('');
}

async function createUnifiedContent() {
  const topic = (document.getElementById('cs-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic first'); return; }

  const postType = document.getElementById('cs-type')?.value || 'image';
  const language = document.querySelector('input[name="cs-lang"]:checked')?.value || 'bilingual';
  const channels = [...document.querySelectorAll('input[name="cs-channel"]:checked')].map(c=>c.value);

  const btn = document.getElementById('cs-create-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creating…'; }
  document.getElementById('cs-progress').style.display = 'block';
  document.getElementById('cs-output').style.display = 'none';
  window._csSteps = {};
  window._csCurrentTopic = topic;
  window._csCurrentType = postType;
  window._csCurrentLang = language;
  window._csChannels = channels;

  try {
    // Load context for AI learning
    const [
      {data: bp},
      {data: recentPosts},
      {data: topPerformers}
    ] = await Promise.all([
      sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null})),
      sb.from('content_posts').select('topic,master_text,language,post_type').order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]})),
      sb.from('ai_learning_log').select('*').order('engagement_rate',{ascending:false}).limit(3).then(r=>r,()=>({data:[]}))
    ]);

    // Build language instruction
    const langInstructions = {
      bilingual: 'Write with a Telugu headline/greeting (2-4 words in Telugu script), then English body. End with a Telugu CTA like "ఇప్పుడే సందర్శించండి!" followed by English contact.',
      te: 'Write entirely in Telugu script. Natural Telugu as spoken in Vijayawada.',
      en: 'Write entirely in English.'
    };

    const learningContext = (topPerformers||[]).length
      ? 'High-performing past patterns: ' + (topPerformers||[]).map(p=>`${p.post_type} ${p.language} ${p.what_worked}`).join('; ')
      : '';

    const recentContext = (recentPosts||[]).length
      ? 'Recent posts (avoid repeating): ' + (recentPosts||[]).map(p=>p.topic).join(', ')
      : '';

    // STAGE 1: Master content
    csStep(1, 'pending', 'Writing master content…');

    const postTypePrompts = {
      image: 'Write a promotional post for an image.',
      reel: 'Write a reel caption (short, punchy, hook-first).',
      gif: 'Write a short animated post caption.',
      festival: 'Write a warm festival greeting with business mention. Telugu preferred.',
      qa: 'Write a tip or Q&A post in carousel slide format (5 slides: question → answer steps → CTA).'
    };

    const contentRes = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action: 'generate_text', agent: 'Content Studio',
        prompt: `You are writing social media content for V Wholesale, a premium home building materials store in Vijayawada, Andhra Pradesh, India.

TOPIC: ${topic}
POST TYPE: ${postType}
${postTypePrompts[postType]||''}

LANGUAGE: ${langInstructions[language]}

BRAND: V Wholesale | Visit V Wholesale| Phone: 8712697930 | vwholesale.in
CATEGORIES: Tiles, Granite, Marble, Sanitaryware, Paints, Electricals, Flooring, False Ceiling

${learningContext}
${recentContext}

REQUIREMENTS:
- 200-400 characters of main content
- After content: blank line, then 10-15 hashtags
- Hashtags mix: local (#Vijayawada #AndhraPradesh #Bhavanipuram), category, intent (#HomeRenovation #InteriorDesign), brand (#VWholesale)
- Natural tone — written like a real store owner, not a corporate ad

Return JSON:
{
  "master_text": "full post with hashtags",
  "seo_keywords": ["5-7 search keywords"],
  "reel_script": ${postType === 'reel' ? '{"hook":"","shots":["scene 1","scene 2","scene 3"],"onscreen_text":["text 1","text 2","text 3"],"voiceover":"optional script","caption":"short caption"}' : 'null'}
}`,
        context: { topic, language, type: postType, brand: 'V Wholesale' }
      })
    });
    const contentData = await contentRes.json();
    const output = contentData.output || {};
    const masterText = output.master_text || '';
    const seoKeywords = output.seo_keywords || [];
    const reelScript = output.reel_script;

    if (!masterText) throw new Error('Content generation failed');

    document.getElementById('cs-master-text').value = masterText;

    if (seoKeywords.length) {
      document.getElementById('cs-seo-keywords').style.display = 'block';
      document.getElementById('cs-kw-pills').innerHTML = seoKeywords.map(k=>
        `<span style="background:rgba(201,168,76,.1);color:var(--gold);border:1px solid rgba(201,168,76,.3);border-radius:12px;padding:2px 8px;font-size:10px">${k}</span>`
      ).join('');
    }

    if (reelScript && postType === 'reel') {
      document.getElementById('cs-reel-output').style.display = 'block';
      const shots = (reelScript.shots||[]).map((sh,i)=>(i+1)+'. '+sh).join('\n');
      const onscreen = (reelScript.onscreen_text||[]).map((t,i)=>'Scene '+(i+1)+': '+t).join('\n');
      document.getElementById('cs-reel-content').textContent =
        '🎬 HOOK (first 3 seconds):\n' + reelScript.hook + '\n\n' +
        '📹 SHOT LIST:\n' + shots + '\n\n' +
        '📝 ON-SCREEN TEXT:\n' + onscreen + '\n\n' +
        (reelScript.voiceover ? '🎙️ VOICEOVER:\n' + reelScript.voiceover + '\n\n' : '') +
        '📌 CAPTION:\n' + reelScript.caption;
    }

    csStep(1, 'done', 'Content written in ' + (language==='bilingual'?'Telugu + English':language==='te'?'Telugu':'English'));

    // STAGE 2: Generate image (skip for reel type)
    if (postType !== 'reel') {
      csStep(2, 'pending', 'Generating 2 poster variations…');
      const imgRes = await fetch(`${MKT_SB_URL}/functions/v1/gbp-image`, {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({topic, post_text: masterText})
      });
      const imgData = await imgRes.json();
      if (imgData.ok && imgData.image_url) {
        window._csVariations = imgData.variations || [imgData.image_url];
        csRenderVariations(imgData.variations||[imgData.image_url], imgData.image_url, imgData.qa_score);
        csStep(2, 'done', `${(imgData.variations||[imgData.image_url]).length} variations ready · QA ${imgData.qa_score||'?'}/10`);
      } else {
        csStep(2, 'done', 'Image generation pending — upload manually');
      }
    } else {
      csStep(2, 'done', 'Reel — record using script above, upload separately');
    }

    // STAGE 3: Adapt for each channel
    csStep(3, 'pending', 'Adapting for ' + channels.length + ' channels…');
    await csAdaptChannels(masterText, channels, language);
    csStep(3, 'done', channels.length + ' channel versions ready');

    // STAGE 4: Save to DB
    csStep(4, 'pending', 'Saving content…');
    const { data: savedPost } = await sb.from('content_posts').insert({
      topic, language, post_type: postType,
      master_text: masterText,
      seo_keywords: seoKeywords,
      hashtags: (masterText.match(/#\w+/g)||[]),
      reel_script: reelScript || null,
      status: 'draft',
      updated_at: new Date().toISOString()
    }).select().single().then(r=>r,()=>({data:null}));

    window._csCurrentPostId = savedPost?.id;
    csStep(4, 'done', 'Saved as draft');

    // Show output
    document.getElementById('cs-output').style.display = 'block';
    setTimeout(() => document.getElementById('cs-output')?.scrollIntoView({behavior:'smooth',block:'start'}), 300);

  } catch(e) {
    csStep(99, 'error', e.message);
    showMktToast('❌ ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Create Content for All Channels'; }
    setTimeout(() => { document.getElementById('cs-progress').style.display='none'; }, 3000);
  }
}

function csRenderVariations(urls, selectedUrl, qaScore) {
  const grid = document.getElementById('cs-image-variations');
  if (!grid) return;
  grid.innerHTML = urls.map((url, i) => `
    <div onclick="csSelectVariation(${i})" data-cvi="${i}"
      style="cursor:pointer;border-radius:8px;overflow:hidden;border:2px solid ${url===selectedUrl?'var(--gold)':'var(--border)'};transition:border .2s">
      <img src="${url}" style="width:100%;height:100px;object-fit:cover;display:block">
      <div style="padding:3px 6px;font-size:10px;text-align:center;color:var(--text3)">
        Option ${i+1}${url===selectedUrl?' ✓':''}${i===0&&qaScore?' · QA '+qaScore+'/10':''}
      </div>
    </div>`).join('');
  csSelectVariation(0, true);
}

function csSelectVariation(idx, silent) {
  const vars = window._csVariations || [];
  if (!vars[idx]) return;
  document.getElementById('cs-image-url').value = vars[idx];
  const preview = document.getElementById('cs-selected-image');
  const img = document.getElementById('cs-selected-img');
  const lbl = document.getElementById('cs-img-label');
  if (preview) preview.style.display = 'block';
  if (img) img.src = vars[idx];
  if (lbl) lbl.textContent = 'Option ' + (idx+1) + ' selected';
  document.querySelectorAll('[data-cvi]').forEach((el,i) => {
    el.style.borderColor = i===idx ? 'var(--gold)' : 'var(--border)';
  });
  if (!silent) showMktToast('Option '+(idx+1)+' selected');
}

async function csAdaptChannels(masterText, channels, language) {
  const CHANNEL_RULES = {
    gbp:             {name:'📍 GBP',              size:'1:1',     note:'No hashtags in body. Max 1500 chars. Local focus.'},
    instagram_feed:  {name:'📸 Instagram Feed',   size:'1:1',     note:'All hashtags. Hook in first line. 150-300 chars.'},
    instagram_story: {name:'📱 Instagram Story',  size:'9:16',    note:'Ultra short. 1-2 lines. Strong CTA.'},
    facebook_post:   {name:'👤 Facebook Post',    size:'1.91:1',  note:'Conversational. 100-200 chars. Fewer hashtags (5).'},
    facebook_story:  {name:'📖 Facebook Story',   size:'9:16',    note:'Very short. 1 line + CTA.'},
    whatsapp_bc:     {name:'💬 WhatsApp Broadcast',size:'1:1',    note:'Personal tone. No hashtags. Include phone 8712697930.'},
    whatsapp_status: {name:'💚 WhatsApp Status',  size:'9:16',    note:'Max 2 lines. Eye-catching. No hashtags.'},
    threads:         {name:'🧵 Threads',           size:'1:1',     note:'Conversational. 150 chars. 2-3 hashtags.'},
    x:               {name:'𝕏 X',                size:'16:9',    note:'Max 280 chars. 2-3 hashtags. Hook-first.'},
    youtube:         {name:'▶️ YouTube',           size:'16:9',    note:'Title + description. SEO keywords. Chapters if reel.'},
  };

  const adaptedVersions = {};
  // For now adapt top 4 channels shown + simple rule-based adaptation for others
  for (const ch of channels) {
    const rule = CHANNEL_RULES[ch];
    if (!rule) continue;
    // Simple adaptation rules (no extra API call to save cost)
    let adapted = masterText;
    if (ch === 'gbp') {
      adapted = masterText.replace(/#[\w\u0C00-\u0C7F]+/g,'').replace(/\s+#[\s\S]*$/,'').trim();
      if (adapted.length > 1500) adapted = adapted.slice(0,1497)+'…';
    } else if (ch === 'whatsapp_bc') {
      adapted = masterText.replace(/#[\w\u0C00-\u0C7F]+/g,'').replace(/\s+#[\s\S]*$/,'').trim();
    } else if (ch === 'instagram_story' || ch === 'facebook_story' || ch === 'whatsapp_status') {
      adapted = masterText.split('\n')[0].slice(0,120);
    } else if (ch === 'x') {
      const noHash = masterText.replace(/#\w+/g,'').trim();
      adapted = noHash.slice(0,240) + ' #VWholesale #Vijayawada';
    } else if (ch === 'threads') {
      adapted = masterText.slice(0,280);
    }
    adaptedVersions[ch] = {name: rule.name, size: rule.size, text: adapted};
  }

  window._csAdaptedVersions = adaptedVersions;
  const container = document.getElementById('cs-channel-versions');
  if (!container) return;
  container.innerHTML = Object.entries(adaptedVersions).map(([ch, v]) => `
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div onclick="toggleChannelVersion('${ch}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg3);cursor:pointer">
        <span style="font-size:12px;font-weight:600;flex:1">${v.name}</span>
        <span style="font-size:10px;color:var(--text3)">${v.size}</span>
        <span style="font-size:10px;color:var(--text3)">${v.text.length} chars</span>
        <span id="ch-toggle-${ch}" style="font-size:11px;color:var(--text3)">▸</span>
      </div>
      <div id="ch-content-${ch}" style="display:none;padding:10px 12px">
        <textarea class="mkt-form-input" id="ch-text-${ch}" rows="4" style="font-size:11px;line-height:1.7">${v.text}</textarea>
        <button onclick="navigator.clipboard.writeText(document.getElementById('ch-text-${ch}').value).then(()=>showMktToast('📋 Copied!'))" class="mkt-btn mkt-btn-ghost" style="margin-top:6px;font-size:11px;padding:4px 10px">📋 Copy</button>
      </div>
    </div>`).join('');
}

function toggleChannelVersion(ch) {
  const el = document.getElementById('ch-content-'+ch);
  const toggle = document.getElementById('ch-toggle-'+ch);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (toggle) toggle.textContent = isOpen ? '▸' : '▾';
}

async function csAdaptLanguage() {
  const topic = window._csCurrentTopic;
  const lang = window._csCurrentLang;
  const type = window._csCurrentType;
  const channels = window._csChannels || ['gbp'];
  if (!topic) return;
  await createUnifiedContent();
}

async function csRegenContent() {
  const topic = (document.getElementById('cs-topic')?.value||window._csCurrentTopic||'').trim();
  if (!topic) { showMktToast('No topic'); return; }
  showMktToast('🔄 Regenerating…');
  await createUnifiedContent();
}

async function csRegenImage() {
  const topic = window._csCurrentTopic || (document.getElementById('cs-topic')?.value||'').trim();
  const text = document.getElementById('cs-master-text')?.value || '';
  showMktToast('🤖 Generating new images…');
  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/gbp-image`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({topic, post_text: text})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    window._csVariations = data.variations || [data.image_url];
    csRenderVariations(data.variations||[data.image_url], data.image_url, data.qa_score);
    showMktToast('✅ New variations ready');
  } catch(e) { showMktToast('❌ '+e.message); }
}

function csHandleUpload(input) {
  const file = input.files[0]; if(!file) return;
  const url = URL.createObjectURL(file);
  window._csVariations = [url];
  csRenderVariations([url], url, null);
  document.getElementById('cs-image-url').value = url;
  showMktToast('✅ Image uploaded');
}

function csCopyMaster() {
  navigator.clipboard.writeText(document.getElementById('cs-master-text')?.value||'').then(()=>showMktToast('📋 Copied!'));
}

function csVerify() {
  const text = document.getElementById('cs-master-text')?.value || '';
  const passes = [], checks = [];
  if (text.length >= 100) passes.push('Length good (' + text.length + ' chars)');
  else checks.push('Too short');
  if ((text.match(/#\w+/g)||[]).length >= 8) passes.push((text.match(/#\w+/g)||[]).length + ' hashtags');
  else checks.push('Add more hashtags');
  if (text.includes('8712697930') || text.includes('vwholesale')) passes.push('Contact info present');
  else checks.push('Missing contact info');
  const el = document.getElementById('cs-verify-result');
  if (el) el.innerHTML = `<div style="background:var(--bg3);border-radius:8px;padding:10px;font-size:12px">
    ${passes.map(p=>`<div style="color:var(--green)">✅ ${p}</div>`).join('')}
    ${checks.map(c=>`<div style="color:#f59e0b">⚠️ ${c}</div>`).join('')}
    ${!checks.length?'<div style="color:var(--green);font-weight:700;margin-top:6px">✅ Ready to publish</div>':''}
  </div>`;
  showMktToast(checks.length ? '⚠️ ' + checks[0] : '✅ Content verified');
}

async function csSendForApproval() {
  const topic = window._csCurrentTopic || (document.getElementById('cs-topic')?.value||'').trim();
  const imageUrl = document.getElementById('cs-image-url')?.value || '';

  const btn = document.querySelector('[onclick="csSendForApproval()"]');
  if (btn) { btn.textContent = '⏳ Sending…'; btn.disabled = true; }

  try {
    // Call notification edge function — handles WhatsApp + DB
    const res = await fetch(MKT_SB_URL+'/functions/v1/content-notifications', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action: 'send_approval',
        agent_name: 'Content Studio',
        topic,
        message: 'Content ready for approval: "'+topic+'". Image: '+(imageUrl?'attached':'not yet')+'. Review in portal.',
        image_url: imageUrl
      })
    });
    const data = await res.json();

    if (window._csCurrentPostId) {
      await sb.from('content_posts').update({status:'pending_approval'}).eq('id', window._csCurrentPostId);
    }

    const waStatus = data.whatsapp_sent
      ? '📲 WhatsApp alert sent to 9038010175'
      : '🔔 Logged in portal (WhatsApp will activate once WABA approved)';

    const el = document.getElementById('cs-verify-result');
    if (el) el.innerHTML = '<div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:10px;font-size:12px;color:var(--gold)">⏳ Approval requested · '+waStatus+'</div>';
    showMktToast('✅ Approval request sent');
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '📲 Send for Approval'; btn.disabled = false; }
  }
}

async function csPublishAll() {
  const text = document.getElementById('cs-master-text')?.value || '';
  const imageUrl = document.getElementById('cs-image-url')?.value || '';
  const channels = window._csChannels || ['gbp'];
  const adaptedVersions = window._csAdaptedVersions || {};
  if (!text) { showMktToast('No content to publish'); return; }

  await navigator.clipboard.writeText(text).catch(()=>{});

  // Track per-channel results for the summary
  const results = {}; // channel -> {ok, url, error}

  // --- AUTO-PUBLISH: Threads ---
  if (channels.includes('threads')) {
    try {
      const threadsText = adaptedVersions['threads']?.text || text;
      const payload = imageUrl
        ? { action:'publish_image', text:threadsText, image_url:imageUrl }
        : { action:'publish_text',  text:threadsText };
      const r = await fetch(MKT_SB_URL+'/functions/v1/threads-api', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify(payload)
      }).then(r=>r.json()).catch(e=>({ok:false,error:e.message}));
      results['threads'] = r.ok ? {ok:true, url:r.url} : {ok:false, error:r.error||'Unknown error'};
    } catch(e) {
      results['threads'] = {ok:false, error:e.message};
    }
  }

  // --- MANUAL channels: Instagram, Facebook, GBP (API pending or quota=0) ---
  // These open in a new tab; staff posts manually
  const manualChannels = channels.filter(ch => !['threads'].includes(ch));

  // Save channel posts to DB
  if (window._csCurrentPostId) {
    const channelRows = channels.map(ch => ({
      content_post_id: window._csCurrentPostId,
      channel: ch,
      adapted_text: adaptedVersions[ch]?.text || text,
      image_url: imageUrl,
      image_size: adaptedVersions[ch]?.size || '1:1',
      status: results[ch]?.ok ? 'published' : (results[ch]?.ok === false ? 'failed' : 'pending'),
      published_at: results[ch]?.ok ? new Date().toISOString() : null,
      platform_post_url: results[ch]?.url || null
    }));
    await sb.from('channel_posts').insert(channelRows).then(()=>{}).catch(()=>{});
    await sb.from('content_posts').update({status:'published',approved_at:new Date().toISOString()}).eq('id',window._csCurrentPostId);
  }

  // Build result summary
  const threadsResult = results['threads'];
  const el = document.getElementById('cs-verify-result');
  if (el) el.innerHTML = `
    <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:10px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">📤 Publishing complete</div>
      ${threadsResult ? `
        <div style="font-size:12px;margin-bottom:8px">
          🧵 Threads: ${threadsResult.ok
            ? '<span style="color:#22c55e">✅ Posted'+(threadsResult.url?' — <a href="'+threadsResult.url+'" target="_blank" style="color:var(--gold)">View post ↗</a>':'')+'</span>'
            : `<span style="color:var(--red)">❌ Failed — ${threadsResult.error}</span>`}
        </div>` : ''}
      ${manualChannels.length ? `
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Text copied to clipboard. Post manually to:</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${manualChannels.includes('gbp')||manualChannels.includes('google_business')
            ? `<a href="https://business.google.com/posts" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:11px;text-decoration:none;padding:8px 12px">📍 GBP ↗</a>` : ''}
          ${manualChannels.includes('instagram_feed')
            ? `<a href="https://www.instagram.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">📸 Instagram ↗</a>` : ''}
          ${manualChannels.includes('facebook_post')
            ? `<a href="https://www.facebook.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">👤 Facebook ↗</a>` : ''}
          ${imageUrl ? `<a href="${imageUrl}" download target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">⬇ Download Image</a>` : ''}
        </div>` : ''}
    </div>`;
  showMktToast(threadsResult?.ok ? '✅ Threads posted! Manual channels copied.' : '✅ Content saved — post manually');
}

function calCardButtons(item, hasImage, isReady, isApproved, isGif) {
  const id = item.id;
  const ct = item.content_type;
  const btnG = (label, onclick, primary, extra) =>
    '<button onclick="'+onclick+'" class="mkt-btn '+(primary?'mkt-btn-primary':'mkt-btn-ghost')+'" style="font-size:11px;padding:6px '+(extra||'10px')+'">'+label+'</button>';

  let html = '';

  // Upload button
  html += btnG(ct==='reel'?'⬆ Video':ct==='gif'?'⬆ GIF':'⬆ Image',
    "document.getElementById('cal-img-"+id+"').click()", false, '10px');

  // Content-type specific
  if (ct === 'gif') {
    html += btnG(hasImage ? '✨ Regen' : '✨ Generate GIF', "calGenerateGif('"+id+"')", !hasImage, '12px');
    if (hasImage) {
  
      html += btnG('✏️', "openPosterEditor('"+id+"')", false, '9px');
    }
  } else if (ct !== 'reel') {
    html += btnG(hasImage ? '🎨 Regen' : '🤖 Generate', "calGeneratePosters('"+id+"')", !hasImage, '12px');
    if (hasImage) html += btnG('✏️', "openPosterEditor('"+id+"')", false, '9px');
  }

  // Preview + History
  if (hasImage) html += btnG('👁', "calPreviewPost('"+id+"')", false, '9px');
  html += btnG('🕐', "openHistoryDrawer('"+id+"')", false, '9px');

  // Approval / posting
  if (isApproved) {
    html += btnG('🚀 Post Now', "calPostNow('"+id+"')", true, '14px;background:#3b82f6');
    html += btnG('↩', "calUnapproveItem('"+id+"')", false, '8px');
  } else if (hasImage) {
    // GIF posts: skip approve step — Post Now directly
    // Image posts: need Approve first (unless already ready)
    if (ct === 'gif' || isReady) {
      if (isReady && ct !== 'gif') html += btnG('✅ Approve', "calApproveItem('"+id+"')", true, '12px;background:#22c55e');
      html += btnG('🚀 Post Now', "calPostNow('"+id+"')", true, '12px;background:#3b82f6');
    } else {
      html += btnG('✅ Approve', "calApproveItem('"+id+"')", true, '12px;background:#22c55e');
    }
  }

  return html;
}
window.calCardButtons = calCardButtons;


function openMktLightbox(src, label, dlSrc, dlName) {
  const existing = document.getElementById('mkt-lightbox');
  if (existing) existing.remove();
  const lb = document.createElement('div');
  lb.id = 'mkt-lightbox';
  lb.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';
  lb.innerHTML = `
    <div style="position:absolute;top:16px;right:16px;display:flex;gap:10px;align-items:center">
      <button onclick="mktForceDownload('${dlSrc}','${dlName}')"
         style="background:var(--gold);color:#111;font-size:13px;font-weight:700;padding:8px 16px;border-radius:8px;text-decoration:none;border:none;cursor:pointer">
        ⬇ Download
      </button>
      <button onclick="document.getElementById('mkt-lightbox').remove()"
              style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:20px;font-weight:700;width:36px;height:36px;border-radius:50%;cursor:pointer;line-height:1">✕</button>
    </div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;font-weight:600">${label}</div>
    <img src="${src}" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:10px;display:block">
  `;
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  document.body.appendChild(lb);
}
async function mktForceDownload(url, filename) {
  try {
    showMktToast('⏳ Preparing download…', 3000);
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  } catch(e) {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}
window.mktForceDownload = mktForceDownload;

function renderReelScriptInline(script, calendarId, existingId) {
  if (!script) return '';
  const text = typeof script === 'string' ? script : JSON.stringify(script, null, 2);
  const lines = text.split('\n');
  return '<div style="font-size:11px;color:var(--text2);line-height:1.7;max-height:120px;overflow-y:auto">'
    + lines.slice(0,6).map(function(l){return '<div>'+l.replace(/</g,'&lt;')+'</div>';}).join('')
    + (lines.length>6?'<div style="color:var(--text3)">…+'+(lines.length-6)+' more lines</div>':'')
    + '</div>';
}
window.renderReelScriptInline = renderReelScriptInline;




function calBuildItemRow(item, contentByTopic, now, TYPE_ICON) {
  const existing = contentByTopic[item.topic];
  const date = new Date(item.cal_date);
  const isToday = date.toISOString().split('T')[0] === now.toISOString().split('T')[0];
  const icon = TYPE_ICON[item.content_type||'post']||'📝';
  const isReady    = item.status === 'ready';
  const isApproved = item.status === 'approved';
  const hasImage   = !!item.image_url;
  const borderColor = isApproved ? '#22c55e' : isReady ? '#f59e0b' : isToday ? 'rgba(201,168,76,.3)' : 'var(--border)';
  const bgColor     = isApproved ? 'rgba(34,197,94,.06)' : isReady ? 'rgba(245,158,11,.06)' : isToday ? 'rgba(201,168,76,.08)' : 'var(--bg3)';

  const statusBadge = isApproved
    ? `<span style="font-size:9px;background:#064e3b;color:#6ee7b7;padding:2px 6px;border-radius:4px;font-weight:700">✅ APPROVED</span>`
    : isReady
    ? `<span style="font-size:9px;background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 6px;border-radius:4px;font-weight:700">⏳ READY</span>`
    : '';

  const isReel = item.is_reel || item.content_type === 'reel';
  const hasCaption = !!item.caption;
  const hasScript  = isReel && existing?.reel_script;
  const posterMsg  = item.poster_message ? `<div style="font-size:10px;color:var(--gold);margin-top:3px;font-style:italic">"${item.poster_message.slice(0,60)}${item.poster_message.length>60?'…':''}"</div>` : '';
  const captionPreview = !isReel && hasCaption
    ? `<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-top:6px;border-top:1px solid var(--border);padding-top:8px">${item.caption.slice(0,120)}${item.caption.length>120?'…':''}</div>`
    : '';
  const hashtagPreview = (item.hashtags||[]).length
    ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px">'+(item.hashtags||[]).slice(0,8).map(h=>'<span style="font-size:9px;background:rgba(201,168,76,.12);color:var(--gold);padding:2px 5px;border-radius:4px">'+h+'</span>').join('')+' <button onclick="navigator.clipboard.writeText(\''+((item.hashtags||[]).join(' ').replace(/\'/g,"\\\'"))+'\'). then(()=>showMktToast(\'📋 Hashtags copied!\'))" class="mkt-btn mkt-btn-ghost" style="font-size:9px;padding:2px 6px">📋 Copy</button></div>'
    : '';
  const platformImages = item.platform_images || {};
  const isGif = item.content_type === 'gif';
  const imagePreviewSection = !isReel && hasImage ? `
    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
      <div style="font-size:10px;color:var(--text3);margin-bottom:6px;font-weight:600">${isGif ? '✨ GIF PREVIEW' : 'POSTER PREVIEW'}</div>
      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">
        ${isGif
          ? [
              { gifKey:'square_gif',  staticKey:'instagram_feed',  label:'1:1 Feed',    w:'90px',  h:'90px'  },
              { gifKey:'story_gif',   staticKey:'instagram_story', label:'9:16 Story',  w:'56px',  h:'99px'  },
              { gifKey:'landscape_gif',staticKey:'facebook_post',  label:'16:9 FB/YT', w:'120px', h:'68px'  },
            ].map(({gifKey,staticKey,label,w,h}) => {
              const gifSrc = platformImages[gifKey] || null;
              const staticSrc = platformImages[staticKey] || null;
              const src = gifSrc || staticSrc;
              const dlName = gifSrc ? gifKey + '.gif' : staticKey + '.png';
              return src ? `<div style="flex-shrink:0;text-align:center;cursor:pointer" onclick="openMktLightbox('${src}','${label}','${src}','${dlName}')" title="Click to expand">
                <img src="${src}" style="width:${w};height:${h};object-fit:contain;border-radius:5px;border:1px solid ${gifSrc?'var(--gold)':'var(--border)'};display:block;background:#f5f0e8">
                <div style="font-size:9px;color:${gifSrc?'var(--gold)':'var(--text3)'};margin-top:2px">${gifSrc?'✨':''} ${label}</div>
              </div>` : '';
            }).join('')
          : [
              {key:'square',label:'1:1',aspect:'1/1'},
              {key:'story',label:'9:16',aspect:'9/16'},
              {key:'landscape',label:'16:9',aspect:'16/9'},
            ].map(({key,label,aspect}) => {
              const url = platformImages[key === 'square' ? 'instagram_feed' : key === 'story' ? 'instagram_story' : 'facebook_post'] || (key === 'square' ? item.image_url : null);
              return url ? `<div style="flex-shrink:0;text-align:center;cursor:pointer" onclick="openMktLightbox('${url}','${label}','${url}','${key}_poster.png')" title="Click to expand">
                <img src="${url}" style="height:72px;aspect-ratio:${aspect};object-fit:contain;border-radius:5px;border:1px solid var(--border);display:block;background:#f5f0e8">
                <div style="font-size:9px;color:var(--text3);margin-top:2px">${label}</div>
              </div>` : '';
            }).join('')}
      </div>
    </div>` : '';

  const expandedPanel = (isReady || isApproved || hasImage) ? `
    <div style="padding:10px 12px;background:${bgColor};border-radius:0 0 8px 8px;border:1px solid ${borderColor};border-top:none">
      ${imagePreviewSection}
      ${posterMsg}
      ${captionPreview}
      ${hashtagPreview}
      ${isReel && item.reel_script ? `<div id="reel-script-${item.id}" style="border-top:1px solid var(--border);padding-top:10px">${renderReelScriptInline(item.reel_script, item.id, existing?.id)}</div>` : ''}
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        ${calCardButtons(item, hasImage, isReady, isApproved, isGif)}
      </div>
      <input type="file" id="cal-img-${item.id}" accept="${item.content_type==='reel'?'video/*':'image/*,image/gif'}" style="display:none" onchange="calHandleImageUpload('${item.id}',this)">
    </div>` : '';

  return `
  <div id="cal-row-${item.id}" style="padding:10px 12px;background:${bgColor};border-radius:8px;border:1px solid ${borderColor}">
    <div style="display:flex;align-items:center;gap:8px">
      <div style="min-width:32px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:${isToday?'var(--gold)':'var(--text1)'}">${date.getDate()}</div>
        <div style="font-size:9px;color:var(--text3)">${date.toLocaleDateString('en-IN',{weekday:'short'})}</div>
      </div>
      <span style="font-size:18px">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cleanTopic(item.topic)||'Untitled'}</div>
        <div style="font-size:10px;color:var(--text3)">${item.content_type||'post'} ${item.notes?'· '+item.notes.slice(0,40):''}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
        ${statusBadge}
        <button onclick="editCalendarItemById('${item.id}',false)" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">✏️</button>
        ${!isApproved ? `<button onclick="calRegenerateItem('${item.id}')" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:3px 8px" title="${isReady?'Regenerate caption + poster':'Generate caption + poster for the first time'}">⚡ ${isReady?'Regen':'Generate'}</button>` : ''}
      </div>
    </div>
    ${expandedPanel}
  </div>`;
}

function buildCalMonthGroups(itemsByMonth, monthLabels, contentByTopic, now, TYPE_ICON) {
  return itemsByMonth.map((mItems, mi) => {
    const mLabel = monthLabels[mi];
    if (!mItems.length) return `
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid var(--gold);display:flex;justify-content:space-between">
          <span>${mLabel}</span><span style="font-size:11px;font-weight:400;color:var(--text3)">0 posts</span>
        </div>
        <div style="font-size:12px;color:var(--text3);padding:12px;background:var(--bg3);border-radius:8px;text-align:center">
          No posts planned — <button onclick="addCalendarItem()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:3px 10px">+ Add</button>
        </div>
      </div>`;
    const rows = mItems.map(item => calBuildItemRow(item, contentByTopic, now, TYPE_ICON)).join('');
    return `
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid var(--gold);display:flex;justify-content:space-between">
          <span>${mLabel}</span><span style="font-size:11px;font-weight:400;color:var(--text3)">${mItems.length} posts</span>
        </div>
        <div style="display:grid;gap:6px">${rows}</div>
      </div>`;
  }).join('');
}

async function renderCalendar(offsetMonths) {
  // Support month navigation — default to current month
  if (typeof offsetMonths !== 'number') offsetMonths = window._calOffset || 0;
  window._calOffset = offsetMonths;

  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading calendar…</div>`);

  const now = new Date();
  const baseMonth = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  // Show 3 months: baseMonth, baseMonth+1, baseMonth+2
  const viewStart = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1).toISOString().split('T')[0];
  const viewEnd   = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 3, 0).toISOString().split('T')[0];

  const monthLabels = [0,1,2].map(i =>
    new Date(baseMonth.getFullYear(), baseMonth.getMonth() + i, 1)
      .toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  );
  const nextStrategyDate = getNextStrategyDate();

  const [
    {data: calItems},
    {data: contentPosts}
  ] = await Promise.all([
    sb.from('content_calendar').select('*').gte('cal_date', viewStart).lte('cal_date', viewEnd).order('cal_date',{ascending:true}).then(r=>r,()=>({data:[]})),
    sb.from('content_posts').select('id,topic,post_type,status,master_text,reel_script,created_at').gte('created_at', viewStart+'T00:00:00').then(r=>r,()=>({data:[]}))
  ]);
  const strategySessions = null;

  const contentByTopic = {};
  (contentPosts||[]).forEach(p => { contentByTopic[p.topic] = p; });

  const reelDays = (calItems||[]).filter(i => i.is_reel === true || i.content_type==='reel');
  const otherDays = (calItems||[]).filter(i => !i.is_reel && i.content_type!=='reel');

  const TYPE_ICON = {image:'🖼️', reel:'🎬', gif:'✨', festival:'🎉', qa:'❓', offer:'💰', post:'📝'};

  const lastSession = (strategySessions||[])[0];
  const daysSinceSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000)
    : 999;
  const sessionDue = daysSinceSession >= 12;

  // Group items by month for display
  const itemsByMonth = [0,1,2].map(i => {
    const mStart = new Date(baseMonth.getFullYear(), baseMonth.getMonth()+i, 1).toISOString().split('T')[0];
    const mEnd   = new Date(baseMonth.getFullYear(), baseMonth.getMonth()+i+1, 0).toISOString().split('T')[0];
    return (calItems||[]).filter(item => item.cal_date >= mStart && item.cal_date <= mEnd);
  });

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📅 Content Calendar</h3>
      <div style="font-size:12px;color:var(--text3)">${monthLabels[0]} – ${monthLabels[2]} · ${(calItems||[]).length} posts</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button onclick="renderCalendar(${offsetMonths-3})" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:5px 12px">← Prev 3 months</button>
      <button onclick="renderCalendar(0)" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:5px 12px" title="Jump to today">Today</button>
      <button onclick="renderCalendar(${offsetMonths+3})" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:5px 12px">Next 3 months →</button>
      <button onclick="addCalendarItem()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 14px">+ Add</button>
    </div>
  </div>

  <!-- REEL DAYS -->
  ${reelDays.length ? `
  <div style="margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">🎬 Reel days — ${reelDays.length} across ${monthLabels[0].split(' ')[0]}–${monthLabels[2].split(' ')[0]}</div>
    <div style="display:grid;gap:10px">
      ${reelDays.map(item => {
        const existing = contentByTopic[item.topic];
        const hasScript = existing?.reel_script;
        const date = new Date(item.cal_date);
        const isPast = date < now;
        const isToday = date.toISOString().split('T')[0] === now.toISOString().split('T')[0];
        return `
        <div class="mkt-card" id="cal-card-${item.id}" style="border-left:3px solid ${isToday?'var(--gold)':hasScript?'#22c55e':'var(--border)'}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="text-align:center;min-width:44px">
              <div style="font-size:20px;font-weight:900;color:${isToday?'var(--gold)':'var(--text1)'}">${date.getDate()}</div>
              <div style="font-size:10px;color:var(--text3)">${date.toLocaleDateString('en-IN',{weekday:'short',month:'short'})}</div>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700" id="cal-topic-display-${item.id}">${(item.topic||'Untitled').replace(/\s*[—–-]\s*(GIF|Reel|Video|Slideshow|Animation|Animated|Campaign)\s*/gi,'').trim()}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px" id="cal-notes-display-${item.id}">${item.notes||''}</div>
            </div>
            <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
              <button onclick="editCalendarItemById('${item.id}',true)" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px" title="Edit topic">✏️</button>
              ${hasScript
                ? '<span class="badge badge-green" style="font-size:10px">✅ Script ready</span>'
                : `<button onclick="generateAndShowReelScript('${(item.topic||'').replace(/'/g,"\'")}','${item.id}',this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:5px 10px">🎬 Script</button>`}
            </div>
          </div>
          ${hasScript ? `<div id="reel-script-${item.id}" style="border-top:1px solid var(--border);padding-top:10px">${renderReelScriptInline(existing.reel_script, item.id, existing.id)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <!-- ALL PLANNED POSTS — grouped by month -->
  <div style="display:grid;gap:20px">
    ${buildCalMonthGroups(itemsByMonth, monthLabels, contentByTopic, now, TYPE_ICON)}
  </div>`);
}

function getNextStrategyDate() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Fortnightly = 1st and 15th of each month
  if (day < 15) return new Date(year, month, 15).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  return new Date(year, month+1, 1).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

// Safe wrapper — looks up item by id from DB to avoid special-char issues in onclick strings
async function editCalendarItemById(id, isReel) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', id).single();
  if (!item) { showMktToast('❌ Could not load item'); return; }
  editCalendarItem(item.id, item.topic || '', item.content_type || (isReel ? 'reel' : 'image'), item.notes || '', isReel);
}

function editCalendarItem(id, currentTopic, type, currentNotes, isReel) {
  const ov = document.createElement('div');
  ov.id = 'edit-cal-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
  ov.innerHTML = `
    <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:420px;border:1px solid var(--border)">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">✏️ Edit calendar day</div>
      <div style="display:grid;gap:10px">
        <div>
          <label class="mkt-form-label">Topic / Campaign name</label>
          <input id="edit-cal-topic" class="mkt-form-input" value="${currentTopic}" placeholder="What is this post about?">
        </div>
        <div>
          <label class="mkt-form-label">Notes for AI (optional)</label>
          <textarea id="edit-cal-notes" class="mkt-form-input" rows="2" placeholder="Any specific angles, products, offers to mention?">${currentNotes}</textarea>
        </div>
        <div>
          <label class="mkt-form-label">Format</label>
          <select id="edit-cal-type" class="mkt-form-select">
            ${[{id:'image',l:'🖼️ Image'},{id:'reel',l:'🎬 Reel'},{id:'gif',l:'✨ GIF'},{id:'festival',l:'🎉 Festival'},{id:'qa',l:'❓ Q&A'}]
              .map(t=>`<option value="${t.id}" ${type===t.id?'selected':''}>${t.l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button onclick="saveEditCalendarItem('${id}')" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;font-weight:700">💾 Save & Auto-Generate</button>
        <button onclick="saveEditCalendarItemOnly('${id}')" class="mkt-btn mkt-btn-ghost" style="padding:10px 14px">Save only</button>
        <button onclick="document.getElementById('edit-cal-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="padding:10px 12px">✕</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('edit-cal-topic')?.focus(), 100);
}

async function saveEditCalendarItem(id) {
  const topic = (document.getElementById('edit-cal-topic')?.value||'').trim();
  const notes = document.getElementById('edit-cal-notes')?.value||'';
  const type = document.getElementById('edit-cal-type')?.value||'image';
  if (!topic) { showMktToast('Enter a topic'); return; }
  document.getElementById('edit-cal-overlay')?.remove();

  // Platform distribution by content type
  const platformByType = {
    // Poster/Image: Feed channels only (no FB Story - needs special Meta permission)
    image:    ['instagram_feed','instagram_story','facebook_post','threads','gbp','whatsapp_story','youtube'],
    // GIF/MP4: Video channels (Shorts for vertical, regular for landscape)
    gif:      ['instagram_feed','instagram_story','facebook_post','threads','whatsapp_story','youtube','youtube_shorts'],
    // Reels: All video channels
    reel:     ['instagram_feed','instagram_story','facebook_post','threads','youtube','youtube_shorts','whatsapp_story'],
    // Festival: Same as image
    festival: ['instagram_feed','instagram_story','facebook_post','threads','gbp','whatsapp_story','youtube'],
    qa:       ['instagram_feed','facebook_post','threads'],
    post:     ['instagram_feed','facebook_post','threads'],
  };
  const platforms = platformByType[type] || platformByType['image'];

  // Update the calendar item
  await sb.from('content_calendar').update({
    topic, notes, content_type:type, is_reel:type==='reel',
    platform: platforms,
    status:'planned', updated_at:new Date().toISOString()
  }).eq('id', id);

  showMktToast('⏳ Generating caption + sending approval email…');

  // Trigger pipeline for this specific item
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/content-pipeline', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'generate_single', calendar_id: parseInt(id)})
    });
    const data = await res.json();
    if(data.ok) {
      showMktToast('✅ Done! Check hmehta@vwholesale.in for approval email');
    } else {
      showMktToast('⚠️ ' + (data.error||'Generation failed'));
    }
  } catch(e) {
    showMktToast('❌ ' + e.message);
  }
  renderCalendar();
}

async function saveEditCalendarItemOnly(id) {
  const topic = (document.getElementById('edit-cal-topic')?.value||'').trim();
  const notes = document.getElementById('edit-cal-notes')?.value||'';
  const type = document.getElementById('edit-cal-type')?.value||'image';
  if (!topic) { showMktToast('Enter a topic'); return; }
  document.getElementById('edit-cal-overlay')?.remove();
  await sb.from('content_calendar').update({
    topic, notes, content_type:type, is_reel:type==='reel', updated_at:new Date().toISOString()
  }).eq('id', id);
  showMktToast('✅ Topic updated');
  renderCalendar();
}

async function openStrategySession_OLD() {
  // Load last session for context
  const { data: sessions } = await sb.from('strategy_sessions').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle().then(r=>r,()=>({data:null}));
  const { data: calItems } = await sb.from('content_calendar').select('topic,content_type,cal_date').gte('cal_date', new Date().toISOString().split('T')[0]).order('cal_date',{ascending:true}).limit(20).then(r=>r,()=>({data:[]}));

  const existingTopics = (calItems||[]).map(c=>`${new Date(c.cal_date).getDate()} ${new Date(c.cal_date).toLocaleString('en-IN',{month:'short'})} — ${c.topic}`).join('\n');
  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN',{month:'long',year:'numeric'});

  const ov = document.createElement('div');
  ov.id = 'strategy-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
  ov.innerHTML = `
    <div style="max-width:560px;margin:0 auto;background:var(--bg2);border-radius:12px;padding:20px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:900">🧠 Strategy Session — ${monthLabel}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Fortnightly planning — human + AI brain working together</div>
        </div>
        <button onclick="document.getElementById('strategy-overlay').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
      </div>

      ${sessions ? `
      <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px">
        <div style="font-weight:700;color:var(--gold);margin-bottom:4px">Last session — ${new Date(sessions.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        <div style="color:var(--text2);line-height:1.7">${sessions.summary||'No summary recorded'}</div>
      </div>` : ''}

      ${existingTopics ? `
      <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px">
        <div style="font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Current calendar</div>
        <div style="color:var(--text2);line-height:1.9;white-space:pre-wrap">${existingTopics}</div>
      </div>` : ''}

      <div style="display:grid;gap:10px;margin-bottom:14px">
        <div>
          <label class="mkt-form-label">What's happening this month? <span style="color:var(--text3);font-weight:400">(promotions, new stock, events, festivals, season)</span></label>
          <textarea id="ss-happening" class="mkt-form-input" rows="3" placeholder="e.g. New marble shipment arrived. Bakrid next week. Monsoon season — good time for waterproofing push. Running 10% off on sanitaryware..."></textarea>
        </div>
        <div>
          <label class="mkt-form-label">Who do you want to reach? <span style="color:var(--text3);font-weight:400">(focus this fortnight)</span></label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${['Home owners','Contractors','Architects','Interior Designers','Builders'].map(a=>`
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:5px 10px">
              <input type="checkbox" name="ss-audience" value="${a}" style="accent-color:var(--gold)"> ${a}
            </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="mkt-form-label">Any specific products or categories to push?</label>
          <input id="ss-products" class="mkt-form-input" placeholder="e.g. Italian marble, Jaquar sanitaryware, Asian Paints, vitrified tiles">
        </div>
        <div>
          <label class="mkt-form-label">Any topics you want AI to suggest for?</label>
          <textarea id="ss-ideas" class="mkt-form-input" rows="2" placeholder="e.g. something about monsoon renovation, a reel showing our showroom, contractor success story..."></textarea>
        </div>
        <div>
          <label class="mkt-form-label">Your notes / context for AI <span style="color:var(--text3);font-weight:400">(anything else)</span></label>
          <textarea id="ss-notes" class="mkt-form-input" rows="2" placeholder="e.g. We had low footfall last week. Competitors are running ads. A contractor brought 3 customers this week..."></textarea>
        </div>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="runStrategySession()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:12px;font-size:13px;font-weight:700">🧠 Generate Content Plan with AI</button>
        <button onclick="document.getElementById('strategy-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="padding:12px 16px">Cancel</button>
      </div>

      <div id="ss-output" style="margin-top:16px"></div>
    </div>`;
  document.body.appendChild(ov);
}

async function runStrategySession() {
  const happening = (document.getElementById('ss-happening')?.value||'').trim();
  const products = (document.getElementById('ss-products')?.value||'').trim();
  const ideas = (document.getElementById('ss-ideas')?.value||'').trim();
  const notes = (document.getElementById('ss-notes')?.value||'').trim();
  const audiences = [...document.querySelectorAll('input[name="ss-audience"]:checked')].map(el=>el.value);

  const out = document.getElementById('ss-output');
  if (out) out.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">⏳ AI is planning your content strategy…</div>';

  try {
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate();
    const { data: existing } = await sb.from('content_calendar').select('topic,content_type,cal_date').gte('cal_date', now.toISOString().split('T')[0]).lte('cal_date', new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]).order('cal_date',{ascending:true}).then(r=>r,()=>({data:[]}));

    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Strategy Session',
        prompt: `You are the marketing strategist for V Wholesale, Vijayawada — a premium home building materials store. Home Depot for Tier 2 India. Target: Vijayawada + 100km radius (Guntur, Eluru, Tenali, Mangalagiri).

STRATEGY SESSION — ${now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
Days remaining this month: ${daysLeft}
Primary audiences this fortnight: ${audiences.join(', ')||'Home owners, Contractors'}

WHAT IS HAPPENING:
${happening||'Normal month'}

PRODUCTS TO PUSH:
${products||'Tiles, Granite, Marble, Sanitaryware'}

HUMAN IDEAS:
${ideas||'None specific'}

ADDITIONAL CONTEXT:
${notes||'None'}

EXISTING CALENDAR:
${(existing||[]).map(c=>`${c.cal_date}: ${c.topic} (${c.content_type})`).join('\n')||'Empty — suggest full plan'}

Based on everything above, create a smart content plan. Return JSON:
{
  "summary": "2-3 sentence summary of this fortnight strategy",
  "key_themes": ["theme1","theme2","theme3"],
  "suggested_posts": [
    {
      "suggested_date": "2026-07-XX",
      "topic": "specific compelling topic",
      "content_type": "image|reel|festival|qa",
      "notes": "angle to take, what to show, key message",
      "audience": "who this targets",
      "why": "why this topic works right now"
    }
  ],
  "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "hashtags": ["#Vijayawada","#HomeRenovation","...15 total"],
  "avoid": "what NOT to post this fortnight and why"
}`,
        context: { happening, products, ideas, audiences }
      })
    });

    const data = await res.json();
    const plan = data.output;
    if (!plan) throw new Error('Strategy generation failed');

    if (out) out.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">🧠 AI Content Strategy</div>

        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:12px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">STRATEGY SUMMARY</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.8">${plan.summary||''}</div>
          ${plan.key_themes?.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+plan.key_themes.map(t=>'<span style="background:var(--bg3);border-radius:12px;padding:3px 10px;font-size:11px;color:var(--gold)">'+t+'</span>').join('')+'</div>' : ''}
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">SUGGESTED POSTS (${(plan.suggested_posts||[]).length})</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          ${(plan.suggested_posts||[]).map((post,i)=>`
          <div style="background:var(--bg3);border-radius:8px;padding:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div style="font-size:12px;font-weight:700">${post.topic}</div>
              <div style="font-size:10px;color:var(--text3);flex-shrink:0;margin-left:8px">${post.suggested_date}</div>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px">${post.content_type} · ${post.audience} · ${post.why}</div>
            <div style="font-size:11px;color:var(--text2)">${post.notes}</div>
            <button onclick="addSuggestedPost('${post.topic.replace(/'/g,"\'")}','${post.content_type}','${post.suggested_date}','${(post.notes||'').replace(/'/g,"\'").replace(/\n/g,' ')}',this)"
              class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:4px 10px;margin-top:8px">+ Add to Calendar</button>
          </div>`).join('')}
        </div>

        ${plan.keywords?.length ? `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">SEO KEYWORDS</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${plan.keywords.map(k=>`<span style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:3px 10px;font-size:11px;color:var(--text2)">${k}</span>`).join('')}</div>
        </div>` : ''}

        ${plan.hashtags?.length ? `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">HASHTAG SET</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.8">${plan.hashtags.join(' ')}</div>
          <button onclick="navigator.clipboard.writeText('${plan.hashtags.join(' ')}').then(()=>showMktToast('📋 Hashtags copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:4px 10px;margin-top:6px">📋 Copy Hashtags</button>
        </div>` : ''}

        ${plan.avoid ? `
        <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:4px">⚠️ AVOID THIS FORTNIGHT</div>
          <div style="font-size:11px;color:var(--text2)">${plan.avoid}</div>
        </div>` : ''}

        <button onclick="saveStrategySession('${(plan.summary||'').replace(/'/g,"\'")}','${(plan.key_themes||[]).join(', ').replace(/'/g,"\'")}',this)" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">💾 Save Session & Apply to Calendar</button>
      </div>`;

  } catch(e) {
    if (out) out.innerHTML = `<div style="color:var(--red);padding:10px">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  }
}

async function addSuggestedPost(topic, type, date, notes, btn) {
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
  try {
    await sb.from('content_calendar').insert({
      topic, content_type:type, cal_date:date, notes, is_reel:type==='reel',
      status:'planned', created_at:new Date().toISOString()
    });
    if (btn) { btn.textContent = '✅ Added'; btn.style.background='#22c55e'; btn.style.color='#000'; }
    showMktToast('✅ "'+topic+'" added to calendar');
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '+ Add to Calendar'; btn.disabled = false; }
  }
}

async function saveStrategySession(summary, themes, btn) {
  if (btn) { btn.textContent = '⏳ Saving…'; btn.disabled = true; }
  try {
    await sb.from('strategy_sessions').insert({
      summary, key_themes:themes, created_at:new Date().toISOString()
    });
    showMktToast('✅ Strategy session saved!');
    document.getElementById('strategy-overlay')?.remove();
    renderCalendar();
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '💾 Save Session'; btn.disabled = false; }
  }
}


async function generateAndShowReelScript(topic, calId, btn, regenerate) {
  if (!topic) { showMktToast('No topic for this reel'); return; }
  if (btn) { btn.textContent = '⏳ Writing script…'; btn.disabled = true; }

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Reel Script Generator',
        prompt: `Write a complete Instagram Reel / YouTube Shorts script for V Wholesale, Vijayawada.

TOPIC: ${topic}
STORE: V Wholesale | Visit V Wholesale| 8712697930 | vwholesale.in
CATEGORIES: Tiles, Granite, Marble, Sanitaryware, Paints, Electricals

Return JSON:
{
  "duration": "30-45 seconds",
  "hook": "First 3 seconds — spoken line or text to stop the scroll",
  "telugu_hook": "Same hook in Telugu script for Telugu version",
  "shots": [
    {"scene": 1, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 5},
    {"scene": 2, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 8},
    {"scene": 3, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 8},
    {"scene": 4, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 7},
    {"scene": 5, "what_to_film": "specific instruction", "onscreen_text": "CTA text", "duration_sec": 7}
  ],
  "voiceover": "Full spoken script matching the shots",
  "caption": "Instagram caption with strong hook first line, then copy, then hashtags",
  "best_time_to_post": "e.g. Tuesday 7:00pm",
  "topic": "${topic}"
}`,
        context: { topic }
      })
    });
    const data = await res.json();
    const script = data.output;
    if (!script || typeof script !== 'object') throw new Error('Script generation failed');

    // Save to content_posts
    const { data: existing } = await sb.from('content_posts').select('id').eq('topic', topic).maybeSingle().then(r=>r,()=>({data:null}));
    if (existing?.id) {
      await sb.from('content_posts').update({reel_script: script, post_type:'reel', status:'scripted', updated_at:new Date().toISOString()}).eq('id', existing.id);
    } else {
      await sb.from('content_posts').insert({topic, post_type:'reel', reel_script:script, status:'scripted', language:'bilingual', created_at:new Date().toISOString(), updated_at:new Date().toISOString()});
    }

    // Update calendar item status
    if (calId) await sb.from('content_calendar').update({status:'scripted'}).eq('id', calId);

    // Show inline
    const scriptEl = document.getElementById('reel-script-'+calId);
    if (scriptEl) {
      scriptEl.style.display = 'block';
      scriptEl.style.borderTop = '1px solid var(--border)';
      scriptEl.style.paddingTop = '10px';
      scriptEl.innerHTML = renderReelScriptInline(script, calId, existing?.id||'');
    }
    if (btn) btn.outerHTML = '<span class="badge badge-green">✅ Script ready</span>';
    showMktToast('✅ Script ready — scroll down to see it');
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '🎬 Generate Script'; btn.disabled = false; }
  }
}

async function uploadReel(input, calId, postId) {
  const file = input.files[0];
  if (!file) return;
  const maxMB = 200;
  if (file.size > maxMB*1024*1024) { showMktToast('Video must be under '+maxMB+'MB'); return; }

  const statusEl = document.getElementById('reel-upload-status-'+calId);
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--gold)">⏳ Uploading reel… ('+Math.round(file.size/1024/1024)+'MB)</span>';

  try {
    const fileName = 'reels/'+Date.now()+'_'+file.name.replace(/[^a-z0-9._]/gi,'_').toLowerCase();
    const { error } = await sb.storage.from('marketing-assets').upload(fileName, file, {contentType:file.type, upsert:true});
    if (error) throw new Error(error.message);

    const { data: urlData } = sb.storage.from('marketing-assets').getPublicUrl(fileName);
    const videoUrl = urlData.publicUrl;

    // Update content post with video URL
    if (postId) {
      await sb.from('content_posts').update({master_image_url: videoUrl, status:'recorded', updated_at:new Date().toISOString()}).eq('id', postId);
    }
    // Update calendar
    if (calId) await sb.from('content_calendar').update({status:'recorded'}).eq('id', calId).then(()=>{}).catch(()=>{});

    if (statusEl) statusEl.innerHTML = '<span style="color:#22c55e">✅ Reel uploaded! <a href="'+videoUrl+'" target="_blank" style="color:var(--gold)">View ↗</a></span>';
    showMktToast('✅ Reel uploaded and saved!');
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">❌ Upload failed: '+e.message+'</span>';
    showMktToast('❌ Upload failed: '+e.message);
  }
}

async function quickCreateFromCalendar(topic, type, language) {
  if (!topic) return;
  // Show inline generation status on the calendar card
  const btn = event?.target;
  if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }
  showMktToast('⚡ Auto-creating content for: ' + topic);

  try {
    const lang = type === 'festival' ? 'te' : (language || 'bilingual');
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Calendar Auto-Creator',
        prompt: `Create a social media post for V Wholesale, Vijayawada.

TOPIC: ${topic}
FORMAT: ${type || 'image'}
LANGUAGE: ${lang === 'bilingual' ? 'Telugu headline + English body' : lang === 'te' ? 'Full Telugu' : lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : lang === 'kn' ? 'Kannada' : 'English'}
STORE: V Wholesale | Visit V Wholesale| 8712697930 | vwholesale.in
PRODUCTS: Tiles, Granite, Marble, Sanitaryware, Paints, Electricals

Return JSON:
{
  "master_text": "Full post copy ready to publish (hook + body + CTA)",
  "gbp_text": "GBP version — no hashtags, professional tone, under 300 chars",
  "instagram_caption": "Instagram version with hook + hashtags (12-15)",
  "facebook_text": "Facebook version — slightly longer, warm tone",
  "threads_text": "Threads version — conversational, under 200 chars",
  "whatsapp_text": "WhatsApp broadcast — personal, action-oriented",
  "hashtags": ["#Vijayawada","#HomeRenovation","...10 more"],
  "image_prompt": "Detailed description for AI image generation",
  "gif_frames": "If content_type is gif: describe 3 frames for before/after or product loop animation",
  "best_time": "e.g. Tuesday 7:00pm"
}`,
        context: { topic, type, language: lang }
      })
    });
    const data = await res.json();
    const content = data.output;
    if (!content) throw new Error('Generation failed');

    // Save to content_posts
    const { data: saved, error } = await sb.from('content_posts').upsert({
      topic,
      post_type: type || 'image',
      language: lang,
      master_text: content.master_text || '',
      status: 'pending_approval',
      reel_script: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'topic' }).select().single().then(r=>r,()=>({data:null,error:'save failed'}));

    // Save channel adaptations
    if (saved?.id) {
      const channelRows = [
        {content_post_id:saved.id, channel:'gbp',           adapted_text:content.gbp_text||'',           status:'pending_approval'},
        {content_post_id:saved.id, channel:'instagram_feed', adapted_text:content.instagram_caption||'',  status:'pending_approval'},
        {content_post_id:saved.id, channel:'facebook_post',  adapted_text:content.facebook_text||'',      status:'pending_approval'},
        {content_post_id:saved.id, channel:'threads',        adapted_text:content.threads_text||'',       status:'pending_approval'},
        {content_post_id:saved.id, channel:'whatsapp_bc',    adapted_text:content.whatsapp_text||'',      status:'pending_approval'},
      ].filter(r => r.adapted_text);
      await sb.from('channel_posts').upsert(channelRows, {onConflict:'content_post_id,channel'}).then(()=>{}).catch(()=>{});
    }

    // Update calendar status
    await sb.from('content_calendar').update({status:'scripted',updated_at:new Date().toISOString()}).eq('topic', topic).then(()=>{}).catch(()=>{});

    // Send for approval notification
    await sb.from('agent_notifications').insert({
      agent_name: 'Calendar Auto-Creator',
      notification_type: 'approval_request',
      message: 'New post ready for approval:\n\nTopic: "'+topic+'"\nType: '+type+'\nLanguage: '+lang+'\n\n'+content.master_text?.slice(0,200)+'\n\nBest time: '+(content.best_time||'TBD'),
      action_required: true,
      response: 'pending',
      created_at: new Date().toISOString()
    }).then(()=>{}).catch(()=>{});

    showMktToast('✅ Content created and sent for approval!');
    // Refresh calendar to show updated status
    setTimeout(() => renderCalendar(), 600);
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '⚡ Auto-Create'; btn.disabled = false; }
  }
}

function addCalendarItem(defaultType) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
  ov.innerHTML = `
    <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:400px;border:1px solid var(--border)">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">Add to calendar</div>
      <div style="display:grid;gap:8px">
        <input id="cal-topic" class="mkt-form-input" placeholder="Topic / campaign name">
        <input id="cal-date" class="mkt-form-input" type="date" value="${new Date().toISOString().split('T')[0]}">
        <select id="cal-type" class="mkt-form-select">
          ${[{id:'image',l:'🖼️ Image'},{id:'reel',l:'🎬 Reel'},{id:'gif',l:'✨ GIF'},{id:'festival',l:'🎉 Festival'},{id:'qa',l:'❓ Q&A'}]
            .map(t=>`<option value="${t.id}" ${defaultType===t.id?'selected':''}>${t.l}</option>`).join('')}
        </select>
        <select id="cal-lang" class="mkt-form-select">
          <option value="bilingual">Bilingual (recommended)</option>
          <option value="te">Telugu</option>
          <option value="en">English</option>
        </select>
        <textarea id="cal-notes" class="mkt-form-input" rows="2" placeholder="Notes (optional)"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="saveCalendarItem()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;font-size:13px;font-weight:700">Save</button>
        <button onclick="this.closest('[style*=fixed]').remove()" class="mkt-btn mkt-btn-ghost" style="padding:10px 16px">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('cal-topic')?.focus(), 100);
}

async function saveCalendarItem() {
  const topic = (document.getElementById('cal-topic')?.value||'').trim();
  const date = document.getElementById('cal-date')?.value;
  const type = document.getElementById('cal-type')?.value||'image';
  const notes = document.getElementById('cal-notes')?.value||'';
  if (!topic || !date) { showMktToast('Enter topic and date'); return; }

  await sb.from('content_calendar').insert({topic, cal_date:date, content_type:type, is_reel:type==='reel', notes, status:'planned', created_at:new Date().toISOString()});
  document.querySelector('[style*="fixed"][style*="z-index:99999"]')?.remove();
  showMktToast('✅ Added to calendar');
  renderCalendar();
}


async function loadCalendar() {
  const monthName = new Date(_calYear, _calMonth, 1).toLocaleString("en-IN", {month:"long", year:"numeric"});
  const btn = document.getElementById("cal-month-label");
  if (btn) btn.textContent = monthName;

  // Load from DB
  const firstDay = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-01`;
  const lastDay  = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-${new Date(_calYear,_calMonth+1,0).getDate()}`;

  const [{data:items},{data:festivals}] = await Promise.all([
    sb.from("content_calendar").select("*").gte("cal_date",firstDay).lte("cal_date",lastDay).order("cal_date",{ascending:true}).then(r=>r,()=>({data:[]})),
    sb.from("festival_calendar").select("*").gte("festival_date",firstDay).lte("festival_date",lastDay).then(r=>r,()=>({data:[]}))
  ]);

  _calItems = items || [];
  _calFestivals = festivals || [];

  renderCalGrid();
  renderCalSummary();
  renderCalReels();
}

function renderCalGrid() {
  const grid = document.getElementById("cal-grid");
  if (!grid) return;

  const firstDay = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date();

  let html = "";
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div style="min-height:64px"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayItems = _calItems.filter(i => i.cal_date === dateStr);
    const dayFests = _calFestivals.filter(f => f.festival_date === dateStr);
    const isToday = today.getFullYear()===_calYear && today.getMonth()===_calMonth && today.getDate()===d;
    const isReel = dayItems.some(i=>i.is_reel);
    const hasFest = dayFests.length > 0;
    const allDone = dayItems.length > 0 && dayItems.every(i=>i.status==="published");
    const hasDraft = dayItems.some(i=>["planned","scripted","ready"].includes(i.status));

    const bg = isToday ? "rgba(201,168,76,0.15)" : "var(--bg3)";
    const border = isToday ? "1px solid var(--gold)" : hasFest ? "1px solid rgba(139,92,246,0.4)" : "1px solid var(--border)";

    html += `<div onclick="calSelectDay(${d},'${dateStr}')" style="min-height:64px;background:${bg};border:${border};border-radius:6px;padding:4px;cursor:pointer;position:relative" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='${isToday?'var(--gold)':hasFest?'rgba(139,92,246,0.4)':'var(--border)'}'">
      <div style="font-size:11px;font-weight:${isToday?'900':'600'};color:${isToday?'var(--gold)':'var(--text1)'};">${d}</div>
      ${hasFest ? `<div style="font-size:9px;color:#8b5cf6;line-height:1.2;margin-top:1px;overflow:hidden;max-height:20px">${dayFests[0].festival_name.slice(0,14)}</div>` : ''}
      ${dayItems.slice(0,2).map(i=>`<div style="font-size:9px;padding:1px 3px;border-radius:3px;margin-top:1px;background:${i.status==='published'?'rgba(34,197,94,0.2)':i.status==='ready'?'rgba(59,130,246,0.2)':'rgba(201,168,76,0.15)'};color:${i.status==='published'?'#22c55e':i.status==='ready'?'#3b82f6':'var(--gold)'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${i.content_type==='reel'?'🎬':i.is_festival?'🎉':'📝'} ${(i.title||i.topic||'').slice(0,12)}</div>`).join('')}
      ${dayItems.length > 2 ? `<div style="font-size:9px;color:var(--text3)">+${dayItems.length-2} more</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

function renderCalSummary() {
  const el = document.getElementById("cal-summary");
  if (!el) return;
  const total = _calItems.length;
  const published = _calItems.filter(i=>i.status==="published").length;
  const reels = _calItems.filter(i=>i.is_reel).length;
  const festivals = _calFestivals.length;
  const planned = _calItems.filter(i=>i.status==="planned").length;

  el.innerHTML = [
    {icon:"📝", label:"Total Posts", val:total},
    {icon:"✅", label:"Published", val:published},
    {icon:"🎬", label:"Reels", val:reels},
    {icon:"🎉", label:"Festivals", val:festivals},
    {icon:"📋", label:"Planned", val:planned}
  ].map(m=>`<div class="mkt-card" style="padding:10px;text-align:center">
    <div style="font-size:18px">${m.icon}</div>
    <div style="font-size:18px;font-weight:900;margin:2px 0">${m.val}</div>
    <div style="font-size:10px;color:var(--text3)">${m.label}</div>
  </div>`).join("");
}

function renderCalReels() {
  const el = document.getElementById("cal-reels");
  if (!el) return;
  const reels = _calItems.filter(i=>i.is_reel).sort((a,b)=>a.cal_date.localeCompare(b.cal_date));
  if (!reels.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--text3)">No reels planned this month — use AI Plan Month to generate the schedule</div>`;
    return;
  }
  el.innerHTML = `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">📌 Schedule a cameraman for these dates</div>
  <div style="display:grid;gap:6px">` +
  reels.map(r=>`<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px">
    <div style="font-size:20px">🎬</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700">${r.topic||r.title||"Reel"}</div>
      <div style="font-size:11px;color:var(--text3)">${new Date(r.cal_date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div>
      ${r.reel_script ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${r.reel_script.slice(0,80)}…</div>` : ""}
    </div>
    <span class="badge ${r.status==="published"?"badge-green":r.status==="ready"?"badge-blue":"badge-gray"}">${r.status}</span>
  </div>`).join("") + "</div>";
}

function calSelectDay(d, dateStr) {
  const panel = document.getElementById("cal-day-panel");
  if (!panel) return;
  const dayItems = _calItems.filter(i=>i.cal_date===dateStr);
  const dayFests = _calFestivals.filter(f=>f.festival_date===dateStr);
  const dateLabel = new Date(dateStr+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  panel.style.display = "block";
  panel.innerHTML = `<div class="mkt-card" style="margin-bottom:14px;border:1px solid var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:14px;font-weight:900">${dateLabel}</div>
      <div style="display:flex;gap:6px">
        <button class="mkt-btn mkt-btn-primary" onclick="showAddCalItem('${dateStr}')" style="font-size:11px">+ Add Post</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('cal-day-panel').style.display='none'" style="font-size:11px">✕</button>
      </div>
    </div>
    ${dayFests.map(f=>`<div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:#8b5cf6">🎉 ${f.festival_name}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${f.description||""}</div>
      ${(f.content_ideas||[]).length?`<div style="font-size:11px;color:var(--text2);margin-top:4px">Ideas: ${f.content_ideas.join(" · ")}</div>`:""}
      <button class="mkt-btn mkt-btn-ghost" onclick="addFestivalPost('${dateStr}','${f.festival_name.replace(/'/g,"\'")}','${(f.content_ideas||[])[0]||""}')" style="font-size:10px;margin-top:6px">+ Create Festival Post</button>
    </div>`).join("")}
    ${dayItems.length===0&&dayFests.length===0?`<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">No content planned — click + Add Post</div>`:""}
    <div style="display:grid;gap:8px">
      ${dayItems.map(item=>`<div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:16px">${item.is_reel?"🎬":item.is_festival?"🎉":"📝"}</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700">${item.title||item.topic||"Post"}</div>
            <div style="font-size:11px;color:var(--text3)">${item.content_type} · ${(item.platform||[]).join(", ")||"—"}</div>
          </div>
          <span class="badge ${item.status==="published"?"badge-green":item.status==="ready"?"badge-blue":item.status==="scripted"?"badge-blue":"badge-gray"}">${item.status}</span>
        </div>
        ${item.topic?`<div style="font-size:11px;color:var(--text2);margin-bottom:6px">${cleanTopic(item.topic)}</div>`:""}
        ${item.reel_script?`<div style="font-size:11px;background:var(--bg2);border-radius:6px;padding:8px;white-space:pre-wrap;margin-bottom:6px;line-height:1.5">${item.reel_script}</div>`:""}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-primary" onclick="generateCalItemContent(${item.id})" style="font-size:10px;padding:3px 8px">🤖 Generate Content</button>
          <button class="mkt-btn mkt-btn-ghost" onclick="updateCalStatus(${item.id},'${item.status}')" style="font-size:10px;padding:3px 8px">
            ${item.status==="planned"?"✏️ Mark Scripted":item.status==="scripted"?"✅ Mark Ready":item.status==="ready"?"📤 Mark Published":"✓ Done"}
          </button>
          <button class="mkt-btn mkt-btn-ghost" onclick="deleteCalItem(${item.id})" style="font-size:10px;padding:3px 8px;color:var(--red)">🗑</button>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
  panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function showAddCalItem(dateStr) {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto";
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">+ Add Post — ${new Date(dateStr+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Content Type</label>
        <select id="ci-type" class="mkt-form-select">
          <option value="post">📝 Post (Photo/Graphic)</option>
          <option value="reel">🎬 Reel (Video)</option>
          <option value="story">💫 Story</option>
          <option value="festival">🎉 Festival Post</option>
          <option value="offer">💰 Offer / Promotion</option>
          <option value="gbp">📍 GBP Update</option>
          <option value="blog">📄 Blog Article</option>
        </select></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Title / Topic *</label>
        <input id="ci-topic" class="mkt-form-input" placeholder="e.g. Kajaria Premium Tiles — Monsoon Special"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Platforms</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${["Instagram","Facebook","WhatsApp","GBP","YouTube","X"].map(p=>`<label style="font-size:11px;background:var(--bg3);padding:4px 8px;border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:4px"><input type="checkbox" value="${p}" ${["Instagram","Facebook"].includes(p)?"checked":""}> ${p}</label>`).join("")}
        </div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="mkt-form-group"><label class="mkt-form-label">Priority</label>
          <select id="ci-priority" class="mkt-form-select"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></div>
        <div class="mkt-form-group" style="display:flex;align-items:center;gap:8px;padding-top:20px">
          <label style="font-size:12px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="ci-reel"> Is a Reel shoot</label>
        </div>
      </div>
      <div class="mkt-form-group"><label class="mkt-form-label">Notes (optional)</label>
        <input id="ci-notes" class="mkt-form-input" placeholder="Any specific instructions or ideas"></div>
      <button class="mkt-btn mkt-btn-primary" onclick="saveCalItem('${dateStr}')" style="width:100%">Save to Calendar</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e=>{if(e.target===m)m.remove();});
}

async function saveCalItem(dateStr) {
  const topic = (document.getElementById("ci-topic")?.value||"").trim();
  if (!topic) { showMktToast("Enter a topic"); return; }
  const type = document.getElementById("ci-type")?.value||"post";
  const platforms = [...document.querySelectorAll('[style*="fixed"] input[type=checkbox]:checked')].map(cb=>cb.value).filter(v=>["Instagram","Facebook","WhatsApp","GBP","YouTube","X"].includes(v));
  const isReel = document.getElementById("ci-reel")?.checked||false;

  await sb.from("content_calendar").insert({
    cal_date: dateStr, content_type: type, topic, title: topic,
    platform: platforms, is_reel: isReel,
    priority: document.getElementById("ci-priority")?.value||"normal",
    notes: document.getElementById("ci-notes")?.value||null,
    status: "planned", created_by: mktProfile?.name
  });

  document.querySelector("[style*=fixed]")?.remove();
  showMktToast("✅ Added to calendar");
  await loadCalendar();
  calSelectDay(parseInt(dateStr.split("-")[2]), dateStr);
}

async function addFestivalPost(dateStr, festName, idea) {
  await sb.from("content_calendar").insert({
    cal_date: dateStr, content_type: "festival",
    title: festName, topic: idea || festName,
    festival_name: festName, is_festival: true,
    platform: ["Instagram","Facebook","GBP"],
    status: "planned", priority: "high",
    created_by: mktProfile?.name
  });
  showMktToast("✅ Festival post added");
  await loadCalendar();
  calSelectDay(parseInt(dateStr.split("-")[2]), dateStr);
}

async function updateCalStatus(id, current) {
  const next = {planned:"scripted", scripted:"ready", ready:"published", published:"planned"}[current]||"scripted";
  await sb.from("content_calendar").update({status:next, updated_at:new Date().toISOString()}).eq("id",id);
  showMktToast(`Status → ${next}`);
  await loadCalendar();
}

async function deleteCalItem(id) {
  if (!confirm("Remove this from calendar?")) return;
  await sb.from("content_calendar").delete().eq("id",id);
  showMktToast("Removed");
  await loadCalendar();
}

async function generateCalItemContent(id) {
  const {data:item} = await sb.from("content_calendar").select("*").eq("id",id).single().then(r=>r,()=>({data:null}));
  if (!item) return;
  showMktToast("🤖 Generating content…");
  const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":MKT_SB_KEY},
    body:JSON.stringify({
      task: item.is_reel ? "reel_script" : "social_post",
      platform: (item.platform||["Instagram"])[0],
      language: "te+en", topic: item.topic||item.title,
      context:{business:"V Wholesale",location:"Vijayawada",type:item.content_type,festival:item.festival_name}
    })
  });
  const data = await res.json();
  const content = data.content||data.text||"";
  if (!content) { showMktToast("❌ Failed"); return; }

  const update = item.is_reel
    ? {reel_script: content, status:"scripted"}
    : {caption: content, status:"scripted"};
  await sb.from("content_calendar").update({...update, updated_at:new Date().toISOString()}).eq("id",id);
  showMktToast("✅ Content generated");
  await loadCalendar();
}

function calPrevMonth() { if (_calMonth === 0) { _calMonth=11; _calYear--; } else { _calMonth--; } loadCalendar(); }
function calNextMonth() { if (_calMonth === 11) { _calMonth=0; _calYear++; } else { _calMonth++; } loadCalendar(); }
function calGoToday() { _calYear=new Date().getFullYear(); _calMonth=new Date().getMonth(); loadCalendar(); }

function showCalPlanModal() {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  const monthName = new Date(_calYear, _calMonth, 1).toLocaleString("en-IN",{month:"long",year:"numeric"});
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">🤖 AI Plan — ${monthName}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div style="font-size:13px;color:var(--text2);line-height:1.6">AI will create a complete month plan including:
        <ul style="margin:8px 0 0 16px;font-size:12px;color:var(--text3)">
          <li>Posts every Mon/Wed/Fri + weekend</li>
          <li>Reel on every 3rd day</li>
          <li>Festival posts auto-added</li>
          <li>Mix of product, offer, contractor, story content</li>
        </ul>
      </div>
      <div class="mkt-form-group"><label class="mkt-form-label">Focus for this month (optional)</label>
        <input id="plan-focus" class="mkt-form-input" placeholder="e.g. Push tiles + monsoon bathroom, Contractor Club recruitment"></div>
      <button class="mkt-btn mkt-btn-primary" onclick="runAIMonthPlan()" style="width:100%;padding:12px;font-size:14px;font-weight:900">🚀 Generate Month Plan</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target===m)m.remove();});
}

async function runAIMonthPlan() {
  const focus = (document.getElementById("plan-focus")?.value||"").trim();
  document.querySelector("[style*=fixed]")?.remove();
  showMktToast("🤖 Planning the month… this takes ~20 seconds");

  const monthName = new Date(_calYear, _calMonth, 1).toLocaleString("en-IN",{month:"long",year:"numeric"});
  const daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  const festivalsThisMonth = _calFestivals.map(f=>f.festival_name).join(", ");

  const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":MKT_SB_KEY},
    body:JSON.stringify({
      task:"month_plan", language:"en",
      topic:`Content plan for ${monthName}`,
      context:{
        business:"V Wholesale", location:"Vijayawada, Andhra Pradesh",
        month: monthName, days_in_month: daysInMonth,
        festivals: festivalsThisMonth||"none this month",
        focus: focus||"balanced mix of product showcase, offers, contractor club, customer stories",
        categories:"Tiles, Granite, Marble, Sanitaryware, Bathroom Fittings, Paints, Electricals, Flooring",
        posting_days:"Mon Wed Fri every week, Sat optional, Reel every 3rd day",
        reel_note:"Manually shot by Himansu/staff — just plan topics and scripts"
      }
    })
  });
  const data = await res.json();
  const plan = data.content||data.text||"";

  // Show plan as a readable modal
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center";
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:600px;overflow:hidden;margin-top:20px">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">📋 ${monthName} Plan</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Review this plan. Add individual items to calendar using + Add Post on each day, or auto-import below.</div>
      <div style="background:var(--bg3);border-radius:8px;padding:14px;font-size:12px;line-height:1.8;white-space:pre-wrap;max-height:400px;overflow-y:auto">${plan}</div>
      <button class="mkt-btn mkt-btn-ghost" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>showMktToast('Copied!'))" style="width:100%;margin-top:10px">📋 Copy Plan</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click",e=>{if(e.target===modal)modal.remove();});
}

function showMonthReview() {
  const nextMonth = new Date(_calYear, _calMonth+1, 1);
  const nextMonthName = nextMonth.toLocaleString("en-IN",{month:"long",year:"numeric"});
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">📋 15th Review — Plan ${nextMonthName}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div style="font-size:13px;line-height:1.6;color:var(--text2)">
        You are reviewing content for <strong>${nextMonthName}</strong>.<br>
        Answer these questions then click Generate Plan.
      </div>
      <div class="mkt-form-group"><label class="mkt-form-label">1. What products/brands to push next month?</label>
        <input id="rev-products" class="mkt-form-input" placeholder="e.g. Asian Paints new range, Italian Marble, Somany tiles"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">2. Any offers or promotions planned?</label>
        <input id="rev-offers" class="mkt-form-input" placeholder="e.g. 15% off sanitaryware, free delivery above 50K"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">3. Reel topics (3 reels per month, every 3rd day)</label>
        <input id="rev-reels" class="mkt-form-input" placeholder="e.g. Showroom walkthrough, Tile laying timelapse, Customer testimonial"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">4. Any special events or launches?</label>
        <input id="rev-events" class="mkt-form-input" placeholder="e.g. New brand launch, Contractor Club meet, Store anniversary"></div>
      <button class="mkt-btn mkt-btn-primary" onclick="generateReviewPlan('${nextMonthName}')" style="width:100%;padding:12px;font-weight:900">🚀 Generate ${nextMonthName} Plan</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target===m)m.remove();});
}

async function generateReviewPlan(monthName) {
  const products = document.getElementById("rev-products")?.value||"";
  const offers = document.getElementById("rev-offers")?.value||"";
  const reels = document.getElementById("rev-reels")?.value||"";
  const events = document.getElementById("rev-events")?.value||"";
  document.querySelector("[style*=fixed]")?.remove();

  _calMonth = _calMonth === 11 ? 0 : _calMonth + 1;
  if (_calMonth === 0) _calYear++;
  await loadCalendar();
  showCalPlanModal();
  setTimeout(()=>{
    const fi = document.getElementById("plan-focus");
    if (fi) fi.value = [products,offers,reels,events].filter(Boolean).join(" | ");
  },300);
}


async function renderAnalytics() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading analytics…</div>`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString();

  const [
    {data: contentPosts},
    {data: channelPosts},
    {data: performance},
    {data: reviews},
    {data: spendData},
    {data: spendMonthly}
  ] = await Promise.all([
    sb.from('content_posts').select('*').gte('created_at', lastMonthStart).order('created_at',{ascending:false}).then(r=>r,()=>({data:[]})),
    sb.from('channel_posts').select('*').gte('created_at', lastMonthStart).then(r=>r,()=>({data:[]})),
    sb.from('post_performance').select('*').gte('recorded_at', lastMonthStart).then(r=>r,()=>({data:[]})),
    sb.from('monthly_reviews').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]})),
    sb.from('generation_history').select('content_type,cost_usd,cost_inr,api_provider,created_at').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]})),
    sb.from('generation_history').select('content_type,cost_inr,created_at').gte('created_at', monthStart).then(r=>r,()=>({data:[]}))
  ]);

  // Spend calculations
  const allSpend = spendData || [];
  const thisMonthSpend = spendMonthly || [];
  const totalSpendINR = allSpend.reduce((a,r) => a+(+r.cost_inr||0), 0);
  const thisMonthINR = thisMonthSpend.reduce((a,r) => a+(+r.cost_inr||0), 0);
  const spendByType = {};
  allSpend.forEach(r => {
    const t = r.content_type || 'other';
    spendByType[t] = (spendByType[t]||{count:0,inr:0});
    spendByType[t].count++;
    spendByType[t].inr += +r.cost_inr||0;
  });
  const costPerItem = {poster:'₹10.20/poster (3 AI images)', gif_animated:'₹3.40/GIF (1 AI image)', gif_slideshow:'₹10.20/slideshow (3 frames)', caption:'₹0.17/caption (GPT-4o)'};
  const maxSpend = Math.max(...Object.values(spendByType).map(v=>v.inr), 1);

  const totalPosts = (contentPosts||[]).length;
  const thisMonth = (contentPosts||[]).filter(p => p.created_at >= new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  const publishedPosts = (channelPosts||[]).filter(p => p.status==='published').length;
  const avgEng = (performance||[]).length
    ? ((performance||[]).reduce((a,p)=>a+(p.engagement_rate||0),0)/(performance||[]).length).toFixed(1)
    : '—';

  const channelCounts = {};
  (channelPosts||[]).forEach(p => { channelCounts[p.channel]=(channelCounts[p.channel]||0)+1; });
  const formatCounts = {};
  (contentPosts||[]).forEach(p => { formatCounts[p.post_type||'image']=(formatCounts[p.post_type||'image']||0)+1; });

  const CHANNEL_LABELS = {gbp:'📍 GBP',instagram_feed:'📸 Instagram',facebook_post:'👤 Facebook',whatsapp_bc:'💬 WhatsApp',threads:'🧵 Threads',x:'𝕏 X',youtube:'▶️ YouTube',youtube_shorts:'▶️ YouTube Shorts',youtube_community:'💬 YT Community Post'};
  const FORMAT_LABELS = {image:'🖼️ Image',reel:'🎬 Reel',gif:'✨ GIF',festival:'🎉 Festival',qa:'❓ Q&A'};
  const barW = (val, max) => Math.max(4, Math.round((val/Math.max(max,1))*100));

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📈 Analytics & Spend</h3>
      <div style="font-size:12px;color:var(--text3)">AI spend tracking + performance data</div>
    </div>
  </div>

  <!-- SPEND ANALYSIS -->
  <div class="mkt-card" style="margin-bottom:16px;border:1px solid rgba(201,168,76,.3)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="mkt-card-title" style="margin:0">💰 AI Spend Analysis</div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:900;color:var(--gold)">₹${thisMonthINR.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--text3)">this month · ₹${totalSpendINR.toFixed(2)} all time</div>
      </div>
    </div>
    <div style="display:grid;gap:8px;margin-bottom:14px">
      ${Object.entries(spendByType).sort((a,b)=>b[1].inr-a[1].inr).map(([type,v]) => {
        const bar = Math.round((v.inr/maxSpend)*100);
        const labels = {poster:'🖼️ Poster',gif_animated:'✨ Animated GIF',gif_slideshow:'🖼️ Slideshow GIF',caption:'📝 Caption'};
        return '<div>'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
          +'<span style="color:var(--text1)">'+(labels[type]||type)+' <span style="color:var(--text3)">×'+v.count+'</span></span>'
          +'<span style="color:var(--gold);font-weight:700">₹'+v.inr.toFixed(2)+'</span>'
          +'</div>'
          +'<div style="background:var(--bg3);border-radius:4px;height:6px">'
          +'<div style="background:var(--gold);border-radius:4px;height:6px;width:'+bar+'%"></div>'
          +'</div>'
          +'</div>';
      }).join('')}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">UNIT COSTS (OpenAI gpt-image-2)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
        ${Object.entries(costPerItem).map(([k,v]) => {
          const labels = {poster:'Poster',gif_animated:'Animated GIF',gif_slideshow:'Slideshow GIF',caption:'Caption'};
          return '<div style="font-size:10px;color:var(--text3)"><span style="color:var(--text2)">'+(labels[k]||k)+':</span> '+v+'</div>';
        }).join('')}
      </div>
    </div>
    <div style="margin-top:10px;background:rgba(201,168,76,.08);border-radius:6px;padding:8px;font-size:11px;color:var(--text3)">
      💡 <strong style="color:var(--text1)">Cost control tips:</strong>
      Use ✨ Regen only when poster quality is poor. Caption + slideshow mode is cheapest (₹0.17 vs ₹10.20).
      Target: ₹500/month = ~49 posters or ~147 GIFs.
    </div>
    <div style="margin-top:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:10px">
      <div style="font-size:11px;font-weight:700;color:#f87171;margin-bottom:6px">📊 Actual OpenAI Spend (from dashboard)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:11px">
        <div style="text-align:center"><div style="font-size:15px;font-weight:900;color:#f87171">$9.24</div><div style="color:var(--text3)">V Wholesale Marketing (active)</div></div>
        <div style="text-align:center"><div style="font-size:15px;font-weight:900;color:#f59e0b">$0.87</div><div style="color:var(--text3)">V Wholesale Marketing (old)</div></div>
        <div style="text-align:center"><div style="font-size:15px;font-weight:900;color:#94a3b8">$0.13</div><div style="color:var(--text3)">V Wholesale (first key)</div></div>
        <div style="text-align:center"><div style="font-size:15px;font-weight:900;color:#ef4444">$10.24</div><div style="color:var(--text3)">≈ ₹870 total (Jul 2026)</div></div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--text3)">
        Most spend is from <strong style="color:#f1f5f9">gpt-image-2</strong> — ₹3.40 per image generated. 
        At current rate (~${allSpend.length} generations = ₹870), monthly run rate ≈ <strong style="color:#f87171">₹870/month</strong> during learning phase.
        Production target: <strong style="color:#22c55e">₹300-500/month</strong> (30-50 posts × ₹10 avg).
        <br><br>
        ⚠️ <strong style="color:#f1f5f9">Action:</strong> Delete the 2 old inactive API keys from OpenAI dashboard to keep tracking clean.
        <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--gold)">Open OpenAI Dashboard →</a>
      </div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;max-height:300px;overflow-y:auto">
    ${[
      {label:'Posts Created', value:totalPosts, sub:thisMonth.length+' this month', color:'var(--gold)'},
      {label:'Published', value:publishedPosts, sub:(totalPosts-publishedPosts)+' pending', color:'#22c55e'},
      {label:'Avg Engagement', value:avgEng+'%', sub:(performance||[]).length+' data points', color:'#3b82f6'},
      {label:'Active Channels', value:Object.keys(channelCounts).length, sub:'of 9 channels', color:'#a855f7'},
    ].map(k=>`<div class="mkt-card" style="text-align:center;padding:14px">
      <div style="font-size:22px;font-weight:900;color:${k.color}">${k.value}</div>
      <div style="font-size:11px;font-weight:600;margin-top:2px">${k.label}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">${k.sub}</div>
    </div>`).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">Posts by channel</div>
      ${Object.keys(channelCounts).length ? Object.entries(channelCounts).sort((a,b)=>b[1]-a[1]).map(([ch,n])=>{
        const max=Math.max(...Object.values(channelCounts));
        return `<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${CHANNEL_LABELS[ch]||ch}</span><span style="font-weight:600">${n}</span></div>
          <div style="height:4px;background:var(--bg3);border-radius:2px"><div style="height:4px;background:var(--gold);border-radius:2px;width:${barW(n,max)}%"></div></div>
        </div>`;}).join('')
      : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No data yet</div>'}
    </div>
    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">Posts by format</div>
      ${Object.keys(formatCounts).length ? Object.entries(formatCounts).sort((a,b)=>b[1]-a[1]).map(([fmt,n])=>{
        const max=Math.max(...Object.values(formatCounts));
        return `<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${FORMAT_LABELS[fmt]||fmt}</span><span style="font-weight:600">${n}</span></div>
          <div style="height:4px;background:var(--bg3);border-radius:2px"><div style="height:4px;background:#3b82f6;border-radius:2px;width:${barW(n,max)}%"></div></div>
        </div>`;}).join('')
      : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No data yet</div>'}
    </div>
  </div>

  <!-- REVIEW GENERATOR -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div style="font-size:13px;font-weight:700;margin-bottom:12px">📊 Generate AI Review</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">Review period</label>
        <select id="review-period" class="mkt-form-select" onchange="reviewPeriodChanged()">
          <option value="weekly">Weekly (last 7 days)</option>
          <option value="fortnightly">Fortnightly (last 14 days)</option>
          <option value="monthly" selected>Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom date range</option>
        </select>
      </div>
      <div id="review-month-picker">
        <label class="mkt-form-label">Month</label>
        <select id="review-month" class="mkt-form-select">
          ${Array.from({length:6},(_,i)=>{
            const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
            const val = d.toISOString().split('T')[0].slice(0,7);
            const lbl = d.toLocaleString('en-IN',{month:'long',year:'numeric'});
            return `<option value="${val}" ${i===0?'selected':''}>${lbl}</option>`;
          }).join('')}
        </select>
      </div>
    </div>
    <div id="review-custom-dates" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">From</label>
        <input id="review-from" class="mkt-form-input" type="date" value="${new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]}">
      </div>
      <div>
        <label class="mkt-form-label">To</label>
        <input id="review-to" class="mkt-form-input" type="date" value="${now.toISOString().split('T')[0]}">
      </div>
    </div>
    <button onclick="generateReview()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">📊 Generate Review</button>
    <div id="review-output" style="margin-top:12px"></div>
  </div>

  <!-- LIVE SOCIAL ANALYTICS -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700">📡 Live Social Analytics</div>
      <button onclick="loadSocialAnalytics()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Refresh</button>
    </div>
    <div id="social-analytics-output">
      <div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">Click Refresh to load live data from Instagram, Facebook and YouTube</div>
    </div>
  </div>

  <!-- PAST REVIEWS -->
  ${(reviews||[]).length ? `
  <div class="mkt-card">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">Past reviews</div>
    <div style="display:grid;gap:8px">
      ${(reviews||[]).map(r=>`
      <div style="padding:10px;background:var(--bg3);border-radius:8px;cursor:pointer" onclick="expandReview('${r.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:700">${r.period_label||r.period_type} Review</div>
            <div style="font-size:10px;color:var(--text3)">${new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <span class="badge ${r.status==='approved'?'badge-green':'badge-gray'}">${r.status||'draft'}</span>
        </div>
        <div id="review-expand-${r.id}" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
          ${r.ai_recommendations?.length ? r.ai_recommendations.map(rec=>`
          <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="background:${rec.priority==='high'?'rgba(239,68,68,.2)':rec.priority==='medium'?'rgba(245,158,11,.2)':'rgba(34,197,94,.2)'};
              color:${rec.priority==='high'?'#ef4444':rec.priority==='medium'?'#f59e0b':'#22c55e'};
              border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;margin-top:2px">${(rec.priority||'').toUpperCase()}</span>
            <div><div style="font-size:12px;font-weight:600">${rec.action}</div><div style="font-size:11px;color:var(--text3)">${rec.reason}</div></div>
          </div>`).join('') : '<div style="font-size:12px;color:var(--text3)">No recommendations recorded</div>'}
          ${r.status!=='approved'?`<button onclick="approveReview('${r.id}')" class="mkt-btn mkt-btn-primary" style="margin-top:8px;width:100%;padding:8px;font-size:12px">✅ Approve</button>`:''}
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}
  `);
}

async function loadSocialAnalytics() {
  const el = document.getElementById('social-analytics-output');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">⏳ Fetching live data from Meta + YouTube…</div>';

  const callFn = async (action) => {
    try {
      const r = await fetch(MKT_SB_URL+'/functions/v1/social-analytics', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({action}),
        signal: AbortSignal.timeout(30000)
      });
      if (!r.ok) return {ok:false, error:'HTTP '+r.status+' '+r.statusText};
      const text = await r.text();
      try { return JSON.parse(text); } catch { return {ok:false, error:'Invalid JSON: '+text.slice(0,100)}; }
    } catch(e) {
      return {ok:false, error: e.name==='TimeoutError' ? 'Timed out after 30s' : e.message};
    }
  };

  const [igRes, fbRes, ytRes] = await Promise.all([
    callFn('instagram_insights'),
    callFn('facebook_insights'),
    callFn('youtube_insights')
  ]);

  console.log('[Analytics] IG:', igRes.ok, igRes.error||'ok');
  console.log('[Analytics] FB:', fbRes.ok, fbRes.error||'ok');
  console.log('[Analytics] YT:', ytRes.ok, ytRes.error||'ok');

  const platforms = [
    { key:'ig', data:igRes, icon:'📸', name:'Instagram', color:'#e1306c' },
    { key:'fb', data:fbRes, icon:'👤', name:'Facebook', color:'#1877f2' },
    { key:'yt', data:ytRes, icon:'▶️', name:'YouTube', color:'#ff0000' }
  ];

  el.innerHTML = `
    <!-- PLATFORM HEADER CARDS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      ${platforms.map(p => {
        if (!p.data.ok) return `
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;opacity:.6">
            <div style="font-size:22px">${p.icon}</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px">${p.name}</div>
            <div style="font-size:10px;color:var(--red);margin-top:4px">${p.data.error?.slice(0,30)||'Not connected'}</div>
          </div>`;

        const acc = p.data.account || {};
        const followerKey = acc.followers !== undefined ? 'followers' : acc.subscribers !== undefined ? 'subscribers' : 'fans';
        const followerCount = (acc.followers || acc.subscribers || acc.fans || 0).toLocaleString('en-IN');
        const secondKey = acc.media_count !== undefined ? 'Posts' : acc.video_count !== undefined ? 'Videos' : 'Page Likes';
        const secondVal = (acc.media_count || acc.video_count || acc.fans || 0).toLocaleString('en-IN');

        return `
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:22px">${p.icon}</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;color:var(--text1)">${p.name}</div>
            <div style="font-size:18px;font-weight:900;color:${p.color};margin-top:6px">${followerCount}</div>
            <div style="font-size:10px;color:var(--text3)">${followerKey}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text2);margin-top:4px">${secondVal} <span style="font-size:10px;color:var(--text3)">${secondKey}</span></div>
          </div>`;
      }).join('')}
    </div>

    <!-- INSTAGRAM RECENT POSTS -->
    ${igRes.ok && igRes.posts?.length ? `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">📸 Instagram — Recent Posts</div>
      <div style="display:grid;gap:6px">
        ${igRes.posts.slice(0,5).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text2)">${p.caption||p.type}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="display:flex;gap:10px;font-size:11px;flex-shrink:0">
            <span title="Likes">❤️ ${p.likes.toLocaleString('en-IN')}</span>
            <span title="Comments">💬 ${p.comments.toLocaleString('en-IN')}</span>
            <span title="Reach" style="color:var(--gold)">👁 ${(p.reach||0).toLocaleString('en-IN')}</span>
            <span title="Engagement Rate" style="color:#22c55e">${p.engagement_rate}%</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- YOUTUBE RECENT VIDEOS -->
    ${ytRes.ok && ytRes.videos?.length ? `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">▶️ YouTube — Recent Videos</div>
      <div style="display:grid;gap:6px">
        ${ytRes.videos.slice(0,5).map(v=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">
          ${v.thumbnail?`<img src="${v.thumbnail}" style="width:48px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0">`:'<div style="width:48px;height:36px;background:var(--bg4);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">▶️</div>'}
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(v.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="display:flex;gap:10px;font-size:11px;flex-shrink:0">
            <span title="Views">👁 ${v.views.toLocaleString('en-IN')}</span>
            <span title="Likes">❤️ ${v.likes.toLocaleString('en-IN')}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- FACEBOOK RECENT POSTS -->
    ${fbRes.ok && fbRes.posts?.length ? `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">👤 Facebook — Recent Posts</div>
      <div style="display:grid;gap:6px">
        ${fbRes.posts.slice(0,3).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text2)">${p.message||'Post'}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="display:flex;gap:10px;font-size:11px;flex-shrink:0">
            <span>❤️ ${p.likes}</span>
            <span>💬 ${p.comments}</span>
            <span>🔁 ${p.shares}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}
  `;
}

function reviewPeriodChanged() {
  const period = document.getElementById('review-period')?.value;
  const monthPicker = document.getElementById('review-month-picker');
  const customDates = document.getElementById('review-custom-dates');
  if (monthPicker) monthPicker.style.display = period === 'monthly' ? 'block' : 'none';
  if (customDates) customDates.style.display = period === 'custom' ? 'grid' : 'none';
}

function expandReview(id) {
  const el = document.getElementById('review-expand-'+id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function runReviewRequestAgent(btn) {
  if (btn) { btn.textContent='⏳ Running…'; btn.disabled=true; }
  const out = document.getElementById('review-request-output');
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Finding eligible customers…</div>';
  try {
    const sevenDaysAgo  = new Date(Date.now() -  7*86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30*86400000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90*86400000).toISOString(); // dedupe window

    // 1. Candidates: purchased 7-30 days ago
    const { data: candidates } = await sb.from('customers')
      .select('id,name,email,phone,last_visit,notes')
      .gte('last_visit', thirtyDaysAgo)
      .lte('last_visit', sevenDaysAgo)
      .not('phone', 'is', null)
      .limit(50)
      .then(r=>r, ()=>({data:[]}));

    if (!candidates?.length) {
      if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">No eligible customers found (purchased 7–30 days ago)</div>';
      return;
    }

    // 2. Already messaged in last 90 days — fetch by phone list
    const phones = candidates.map(c=>c.phone).filter(Boolean);
    const { data: alreadySent } = await sb.from('review_requests_log')
      .select('phone,sent_at')
      .in('phone', phones)
      .gte('sent_at', ninetyDaysAgo)
      .then(r=>r, ()=>({data:[]}));
    const sentPhones = new Set((alreadySent||[]).map(r=>r.phone));

    // 3. Filter out: already sent + complaints/damaged notes
    const COMPLAINT_PATTERN = /damage|broken|complaint|wrong|missing|refund|return|bad|issue|problem/i;
    const eligible = candidates.filter(c => {
      if (sentPhones.has(c.phone)) return false;          // already got review request
      if (c.notes && COMPLAINT_PATTERN.test(c.notes)) return false; // has complaint note
      return true;
    });

    if (!eligible.length) {
      if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">No new eligible customers — all either already messaged (90-day window) or have complaint notes</div>';
      return;
    }

    let waSent = 0, waFailed = 0, emailSent = 0;
    const logRows = [];

    for (const c of eligible) {
      // WhatsApp (primary channel)
      if (c.phone) {
        const r = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({
            action:'send_template', phone:c.phone,
            template_name:'vwholesale_feedback_request',
            body_values:[c.name||'Customer', 'your recent purchase'],
            language_code:'en'
          })
        }).then(r=>r.json()).catch(()=>({ok:false}));
        const status = r.ok ? 'sent' : 'failed';
        if (r.ok) waSent++; else waFailed++;
        logRows.push({ customer_id:c.id, phone:c.phone, channel:'whatsapp', template_name:'vwholesale_feedback_request', status });
      }
      // Email (secondary, if available)
      if (c.email) {
        const er = await fetch(MKT_SB_URL+'/functions/v1/email-marketing', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({ action:'send_review_request', to:c.email, customer_name:c.name||'Customer', product:'building materials' })
        }).then(r=>r.json()).catch(()=>({ok:false}));
        const status = er.ok ? 'sent' : 'failed';
        if (er.ok) emailSent++;
        logRows.push({ customer_id:c.id, phone:c.phone||null, channel:'email', template_name:'review_request_email', status });
      }
    }

    // 4. Write log so we never double-send
    if (logRows.length) {
      await sb.from('review_requests_log').insert(logRows).then(()=>{}).catch(()=>{});
    }

    const skipped = candidates.length - eligible.length;
    showMktToast('WhatsApp: ' + waSent + ' sent · ' + skipped + ' skipped (already sent or complaints)');
    if (out) out.innerHTML =
      '<div style="font-size:11px;color:#22c55e">✅ Done — ' + waSent + ' WhatsApp · ' + emailSent + ' email sent</div>'
      + (waFailed ? '<div style="font-size:10px;color:#f59e0b;margin-top:4px">⚠️ ' + waFailed + ' WhatsApp failed — template may still be in review</div>' : '')
      + (skipped ? '<div style="font-size:10px;color:var(--text3);margin-top:4px">ℹ️ ' + skipped + ' skipped — already messaged within 90 days or complaint note on file</div>' : '');
  } catch(e) {
    showMktToast('❌ ' + e.message);
    if (out) out.innerHTML = '<div style="font-size:11px;color:var(--red)">❌ ' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent='▶️ Run Now'; btn.disabled=false; }
  }
}

async function generateSEOBlogPost(btn) {
  const topic = prompt('Blog post topic? (leave blank for auto-suggest)') || 'tiles in vijayawada';
  if (btn) { btn.textContent='⏳ Writing…'; btn.disabled=true; }
  const out = document.getElementById('seo-blog-output');
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Generating SEO blog post…</div>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_text', agent:'SEO Blog',
        prompt: 'Write a short SEO blog post (400-500 words) for V Wholesale, Vijayawada targeting the keyword "' + topic + '". Include: H1 title, 2-3 subheadings, natural keyword usage, mention V Wholesale at Visit V Wholesale, call to action. Return just the blog post text.',
        context: {} })
    });
    const data = await res.json();
    const content = data.output?.message || typeof data.output === 'string' ? (data.output?.message || data.output) : '';
    if (out && content) {
      out.innerHTML = '<div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;color:var(--text2);line-height:1.8;max-height:200px;overflow-y:auto">' + content + '</div>';
      const blogCopyBtn = document.createElement('button');
      blogCopyBtn.className = 'mkt-btn mkt-btn-ghost';
      blogCopyBtn.style.cssText = 'margin-top:8px;font-size:11px;padding:5px 10px';
      blogCopyBtn.textContent = 'Copy Blog Post';
      blogCopyBtn.onclick = function() { navigator.clipboard.writeText(content).then(function(){ showMktToast('Copied!'); }); };
      out.appendChild(blogCopyBtn);
    }
  } catch(e) { if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '</div>'; }
  finally { if (btn) { btn.textContent='Generate'; btn.disabled=false; } }
}

async function generateYouTubeSEO(btn) {
  const videoTitle = prompt('Enter your video title or topic:');
  if (!videoTitle) return;
  if (btn) { btn.textContent='⏳ Optimizing…'; btn.disabled=true; }
  const out = document.getElementById('yt-seo-output');
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Generating YouTube SEO…</div>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_text', agent:'YouTube SEO',
        prompt: 'Generate YouTube SEO for V Wholesale Vijayawada. Video: "' + videoTitle + '". Return JSON: {"title":"optimized title under 60 chars","description":"300 word SEO description with keywords","tags":["10-15 tags"],"thumbnail_text":"short text for thumbnail overlay"}',
        context: {} })
    });
    const data = await res.json();
    let seo = data.output;
    if (typeof seo === 'string') try { seo = JSON.parse(seo); } catch { seo = { title: videoTitle, description: seo, tags: [], thumbnail_text: '' }; }
    if (typeof seo === 'object' && seo?.message) try { seo = JSON.parse(seo.message); } catch { seo = { title: videoTitle, description: seo.message, tags: [] }; }
    if (out) {
      out.innerHTML = '';
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;gap:8px';

      const addSection = (label, content) => {
        const d = document.createElement('div');
        d.style.cssText = 'background:var(--bg3);border-radius:6px;padding:8px';
        d.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">' + label + '</div>'
          + '<div style="font-size:12px;max-height:80px;overflow-y:auto">' + content + '</div>';
        const btn = document.createElement('button');
        btn.className = 'mkt-btn mkt-btn-ghost';
        btn.style.cssText = 'font-size:10px;padding:2px 8px;margin-top:4px';
        btn.textContent = 'Copy';
        btn.onclick = function() { navigator.clipboard.writeText(content).then(function(){ showMktToast('Copied!'); }); };
        d.appendChild(btn);
        grid.appendChild(d);
      };

      addSection('TITLE', seo?.title || videoTitle);
      addSection('DESCRIPTION', seo?.description || '');
      addSection('TAGS', (seo?.tags || []).join(', '));
      if (seo?.thumbnail_text) addSection('THUMBNAIL TEXT', seo.thumbnail_text);
      out.appendChild(grid);
    }
  } catch(e) { if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '</div>'; }
  finally { if (btn) { btn.textContent='Optimize'; btn.disabled=false; } }
}
// ── Platform size definitions ──
const PLATFORM_SIZES = {
  instagram_feed:  { w:1080, h:1080, label:'Instagram Feed (1:1)' },
  instagram_story: { w:1080, h:1920, label:'Instagram Story (9:16)' },
  facebook_post:   { w:1200, h:630,  label:'Facebook Post (1.91:1)' },
  facebook_story:  { w:1080, h:1920, label:'Facebook Story (9:16)' },
  threads:         { w:1080, h:1080, label:'Threads (1:1)' },
  youtube:         { w:1280, h:720,  label:'YouTube (16:9)' },
  gbp:             { w:1200, h:900,  label:'Google Business (4:3)' },
  whatsapp_story:  { w:1080, h:1920, label:'WhatsApp Status (9:16)' },
};

// Smart crop: crop from centre of source image to target ratio
function cropImageToSize(img, targetW, targetH) {
  const canvas = document.createElement('canvas');
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = targetW / targetH;

  let sx, sy, sw, sh;
  if (srcRatio > dstRatio) {
    // Source is wider — crop sides
    sh = img.naturalHeight;
    sw = Math.round(sh * dstRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
    sy = 0;
  } else {
    // Source is taller — crop top/bottom (keep top-biased for portraits)
    sw = img.naturalWidth;
    sh = Math.round(sw / dstRatio);
    sx = 0;
    sy = Math.round((img.naturalHeight - sh) * 0.35); // 35% from top keeps faces/subjects
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

// Upload one canvas to Supabase storage, return public URL
async function uploadCanvasToStorage(canvas, path, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
      try {
        const res = await fetch(
          `${MKT_SB_URL}/storage/v1/object/calendar-images/${path}`,
          { method:'POST', headers:{'apikey':MKT_SB_KEY,'Authorization':`Bearer ${MKT_SB_KEY}`,'Content-Type':mimeType,'x-upsert':'true'}, body:blob }
        );
        if (!res.ok) { reject(new Error('Upload failed: ' + res.status)); return; }
        resolve(`${MKT_SB_URL}/storage/v1/object/public/calendar-images/${path}`);
      } catch(e) { reject(e); }
    }, mimeType, 0.92);
  });
}

// Main upload handler — auto-crops to all platform sizes
async function calHandleImageUpload(calendarId, input) {
  const file = input.files[0];
  if (!file) return;

  // Reels/videos — just upload as-is, no cropping
  if (file.type.startsWith('video/')) {
    showMktToast('⏳ Uploading video…');
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `calendar/${calendarId}_video_${Date.now()}.${ext}`;
      const res = await fetch(
        `${MKT_SB_URL}/storage/v1/object/calendar-images/${path}`,
        { method:'POST', headers:{'apikey':MKT_SB_KEY,'Authorization':`Bearer ${MKT_SB_KEY}`,'Content-Type':file.type,'x-upsert':'true'}, body:file }
      );
      if (!res.ok) throw new Error('Upload failed: ' + res.status);
      const url = `${MKT_SB_URL}/storage/v1/object/public/calendar-images/${path}`;
      await sb.from('content_calendar').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', calendarId);
      showMktToast('✅ Video uploaded — click Approve & Schedule');
      renderCalendar();
    } catch(e) { showMktToast('❌ Upload failed: ' + e.message); }
    return;
  }

  // Load source image to get dimensions
  const imgEl = new Image();
  const objectUrl = URL.createObjectURL(file);
  imgEl.src = objectUrl;

  showMktToast('⏳ Processing image for all platforms…');

  await new Promise((resolve, reject) => {
    imgEl.onload = resolve;
    imgEl.onerror = reject;
  });

  // Get which platforms this calendar item needs
  const { data: calItem } = await sb.from('content_calendar').select('platform').eq('id', calendarId).single();
  const platforms = calItem?.platform || ['instagram_feed','facebook_post','threads'];

  // Deduplicate by size — no need to upload same crop twice
  const sizeMap = {}; // key: "WxH" → first platform that needs it
  const platformToSize = {}; // platform → "WxH"
  for (const ch of platforms) {
    const sz = PLATFORM_SIZES[ch];
    if (!sz) continue;
    const key = `${sz.w}x${sz.h}`;
    platformToSize[ch] = key;
    if (!sizeMap[key]) sizeMap[key] = { w:sz.w, h:sz.h, platforms:[] };
    sizeMap[key].platforms.push(ch);
  }

  const uploadedUrls = {}; // "WxH" → url
  const platformImages = {}; // platform → url

  let done = 0;
  const total = Object.keys(sizeMap).length;

  for (const [key, sz] of Object.entries(sizeMap)) {
    try {
      const canvas = cropImageToSize(imgEl, sz.w, sz.h);
      const path = `calendar/${calendarId}_${sz.w}x${sz.h}_${Date.now()}.jpg`;
      const url = await uploadCanvasToStorage(canvas, path, 'image/jpeg');
      uploadedUrls[key] = url;
      for (const ch of sz.platforms) platformImages[ch] = url;
      done++;
      showMktToast(`⏳ Processed ${done}/${total} sizes…`);
    } catch(e) {
      console.error(`Crop/upload failed for ${key}:`, e);
    }
  }

  URL.revokeObjectURL(objectUrl);

  if (!Object.keys(platformImages).length) {
    showMktToast('❌ All uploads failed'); return;
  }

  // Master image = square (instagram_feed) or first available
  const masterUrl = platformImages['instagram_feed'] || Object.values(platformImages)[0];

  await sb.from('content_calendar').update({
    image_url: masterUrl,
    platform_images: platformImages,
    updated_at: new Date().toISOString()
  }).eq('id', calendarId);

  const sizeCount = Object.keys(sizeMap).length;
  showMktToast(`✅ ${sizeCount} size${sizeCount>1?'s':''} generated — click Approve & Schedule`);
  renderCalendar();
}

// ── FULLY AUTOMATIC GIF GENERATION FROM CALENDAR ──
// Step 1: Generate caption via content-pipeline
// Step 2: Generate 3 AI poster frames via content-pipeline
// Step 3: Encode GIF in browser via gifenc Web Worker
// Step 4: Upload GIF to Supabase storage
// Step 5: Save URL back to content_calendar, mark ready
// ── GIF Options Popup — offer text + animation style before generation ──
function showGifOptionsPopup(calendarId) {
  const existing = document.getElementById('gif-options-popup');
  if (existing) existing.remove();

  const pop = document.createElement('div');
  pop.id = 'gif-options-popup';
  pop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';

  pop.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:24px;max-width:420px;width:100%;border:1px solid #334155">
      <div style="font-size:17px;font-weight:900;color:#f1f5f9;margin-bottom:4px">✨ Generate GIF</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:20px">Choose what type of GIF you want to create</div>

      <!-- MODE CHOOSER -->
      <div id="gif-mode-section" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">

        <button id="gif-mode-slideshow" onclick="gifSelectMode('slideshow')"
          style="background:#0f172a;border:2px solid #c9a84c;border-radius:12px;padding:16px 10px;cursor:pointer;text-align:center">
          <div style="font-size:24px;margin-bottom:6px">🎞️</div>
          <div style="font-size:12px;font-weight:800;color:#c9a84c;margin-bottom:4px">Poster Slideshow</div>
          <div style="font-size:9px;color:#64748b;line-height:1.4">3 AI posters generated<br>crossfade slideshow GIF</div>
        </button>

        <button id="gif-mode-animated" onclick="gifSelectMode('animated')"
          style="background:#0f172a;border:2px solid #334155;border-radius:12px;padding:16px 10px;cursor:pointer;text-align:center">
          <div style="font-size:24px;margin-bottom:6px">🎬</div>
          <div style="font-size:12px;font-weight:800;color:#f1f5f9;margin-bottom:4px">Animated Poster</div>
          <div style="font-size:9px;color:#64748b;line-height:1.4">1 poster + text & offer<br>animates on top</div>
        </button>

      </div>

      <!-- ANIMATED POSTER OPTIONS (hidden by default) -->
      <div id="gif-animated-opts" style="display:none">
        <div style="border-top:1px solid #334155;padding-top:16px;margin-bottom:16px">
          <label style="font-size:11px;font-weight:700;color:#94a3b8;display:block;margin-bottom:8px">🎨 ANIMATION STYLE</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label id="style-cinematic" style="background:#0f172a;border:2px solid #c9a84c;border-radius:8px;padding:10px;cursor:pointer;text-align:center">
              <input type="radio" name="gif-anim-style" value="cinematic" checked style="display:none">
              <div style="font-size:18px;margin-bottom:3px">🎬</div>
              <div style="font-size:11px;font-weight:700;color:#c9a84c">Cinematic</div>
              <div style="font-size:9px;color:#64748b;margin-top:2px">Fade · Slide · Premium</div>
            </label>
            <label id="style-energetic" style="background:#0f172a;border:2px solid #334155;border-radius:8px;padding:10px;cursor:pointer;text-align:center">
              <input type="radio" name="gif-anim-style" value="energetic" style="display:none">
              <div style="font-size:18px;margin-bottom:3px">⚡</div>
              <div style="font-size:11px;font-weight:700;color:#f1f5f9">Energetic</div>
              <div style="font-size:9px;color:#64748b;margin-top:2px">Bounce · Pop · Offer</div>
            </label>
          </div>
        </div>
        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px;font-size:11px;color:#94a3b8">
          🎵 Music is added in the <strong style="color:#c9a84c">Poster Editor</strong> (✏️ Edit) after generation
        </div>
      </div>

      <!-- ACTIONS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button onclick="document.getElementById('gif-options-popup').remove()"
          style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:10px;border-radius:8px;cursor:pointer;font-size:13px">
          Cancel
        </button>
        <button id="gif-generate-btn" onclick="gifStartGenerate('${calendarId}')"
          style="background:#c9a84c;border:none;color:#111;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">
          ✨ Generate Slideshow GIF
        </button>
      </div>
    </div>`;

  // Mode toggle logic
  pop.querySelectorAll('input[name="gif-anim-style"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('style-cinematic').style.borderColor = '#334155';
      document.getElementById('style-energetic').style.borderColor = '#334155';
      document.getElementById('style-' + radio.value).style.borderColor = '#c9a84c';
    });
  });

  pop.addEventListener('click', e => { if (e.target === pop) pop.remove(); });
  document.body.appendChild(pop);
  mktBindMusicPicker();
}

function gifSelectMode(mode) {
  const slideshowBtn = document.getElementById('gif-mode-slideshow');
  const animatedBtn  = document.getElementById('gif-mode-animated');
  const animOpts     = document.getElementById('gif-animated-opts');
  const generateBtn  = document.getElementById('gif-generate-btn');

  if (mode === 'slideshow') {
    slideshowBtn.style.borderColor = '#c9a84c';
    slideshowBtn.querySelector('div:nth-child(2)').style.color = '#c9a84c';
    animatedBtn.style.borderColor  = '#334155';
    animatedBtn.querySelector('div:nth-child(2)').style.color = '#f1f5f9';
    animOpts.style.display = 'none';
    generateBtn.textContent = '✨ Generate Slideshow GIF';
    generateBtn.dataset.mode = 'slideshow';
  } else {
    animatedBtn.style.borderColor = '#c9a84c';
    animatedBtn.querySelector('div:nth-child(2)').style.color = '#c9a84c';
    slideshowBtn.style.borderColor  = '#334155';
    slideshowBtn.querySelector('div:nth-child(2)').style.color = '#c9a84c';
    animOpts.style.display = 'block';
    generateBtn.textContent = '🎬 Generate Animated GIF';
    generateBtn.dataset.mode = 'animated';
  }
}

function gifStartGenerate(calendarId) {
  const btn = document.getElementById('gif-generate-btn');
  const mode = btn?.dataset.mode || 'slideshow';
  const offer = ''; // Badge removed — AI poster has design baked in
  const style = mode === 'animated' ? (document.querySelector('input[name=gif-anim-style]:checked')?.value || 'cinematic') : '';
  const musicId = 'none'; // Music added via Editor after generation — auto-selected on Post Now
  document.getElementById('gif-options-popup').remove();
  calGenerateGif(calendarId, mode === 'slideshow' ? null : offer, mode === 'slideshow' ? 'slideshow' : style, musicId);
}


async function calGenerateGif(calendarId, offerText, animStyle, musicId) {
  // If not called from popup yet, show chooser first
  if (offerText === undefined && animStyle === undefined) {
    return showGifOptionsPopup(calendarId);
  }

  // Route to correct mode
  const isSlideshow = animStyle === 'slideshow' || offerText === null;
  if (isSlideshow) {
    return calGenerateGifSlideshow(calendarId);
  } else {
    return calGenerateGifAnimated(calendarId, offerText || '', animStyle || 'cinematic', musicId);
  }
}

async function calGenerateGifSlideshow(calendarId) {
  const musicURL = null; // Music added via Editor — slideshow uses no music by default

  const btn = document.getElementById(`gif-btn-${calendarId}`);
  if (btn) { btn.innerHTML = '⏳'; btn.disabled = true; }

  let secs = 0;
  showMktToast('⏳ Generating GIF…', 5000);
  const ticker = setInterval(() => {
    secs += 3;
    showMktToast('⏳ Generating GIF… ' + secs + 's', 5000);
  }, 3000);

  try {
    // STEP 1: Load item + generate brief (caption, headline, message)
    const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
    if (!item) throw new Error('Calendar item not found');

    const RAIL_URL = 'https://vwholesale-render-worker-production.up.railway.app';
    const RAIL_SECRET = 'vw-render-2026-secret';

    // Check if Railway already processed this (gif_status = 'ready')
    if (item.gif_status === 'ready') {
      showMktToast('✅ GIF already generated — ready to post!', 3000);
      clearInterval(ticker);
      const btn2 = document.getElementById('gif-btn-'+calendarId);
      if (btn2) { btn2.innerHTML = '✨'; btn2.disabled = false; }
      renderCalendar();
      return;
    }

    // Fire Railway — it does EVERYTHING (themes + 9 images + 3 MP4s)
    // No waiting — Railway saves to DB as it goes
    showMktToast('⏳ Sending to Railway — generating 9 images + MP4s in background…', 8000);

    // Mark as pending in DB
    await sb.from('content_calendar').update({
      gif_status: 'pending',
      gif_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', calendarId);

    const fireRes = await fetch(RAIL_URL + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': RAIL_SECRET },
      body: JSON.stringify({ action: 'gif_slideshow', calendar_id: parseInt(calendarId) })
    });
    const fireData = await fireRes.json();
    if (!fireData.ok) throw new Error('Railway rejected job: ' + fireData.error);

    showMktToast('✅ Job queued on Railway! Generating 9 images + MP4s (~5-8 min). Check back soon.', 8000);

    // Poll progress from Railway every 10s and show in toast
    const pollInterval = setInterval(async () => {
      try {
        const pr = await fetch(RAIL_URL + '/progress/' + calendarId);
        const pd = await pr.json();
        if (pd.status === 'ready') {
          clearInterval(pollInterval);
          showMktNotif('✅ GIF complete! ' + (pd.has_mp4 ? 'MP4 ready for all channels.' : 'Images ready.'));
          renderCalendar();
        } else if (pd.progress) {
          showMktToast('⏳ Railway: ' + pd.progress.step + ' (' + (pd.progress.done||0) + '/' + (pd.progress.total||9) + ')…', 11000);
        }
      } catch(e) {}
    }, 10000);

    // Clear poll after 10 min max
    setTimeout(() => clearInterval(pollInterval), 600000);

    // Slideshow mode: Railway/Cloudinary handled MP4 above — skip browser GIF encoding
    clearInterval(ticker);
    return; // Exit slideshow flow here

    // Map poster URLs to GIF format structure
    const GIF_FORMATS = [
      { key: 'square',    gifW: 720, gifH: 720, staticKey: 'instagram_feed',  channels: ['instagram_feed','threads'] },
      { key: 'story',     gifW: 480, gifH: 720, staticKey: 'instagram_story', channels: ['instagram_story','facebook_story','whatsapp_story'] },
      { key: 'landscape', gifW: 720, gifH: 480, staticKey: 'facebook_post',   channels: ['facebook_post','youtube','gbp'] },
    ]
    // Fetch slideshow frames via edge function proxy (avoids browser CORS for GIF encoding)
    showMktToast('⏳ Fetching slide images for GIF encoding…', 5000);
    const slideUrls = frameUrls.length ? 
      {square: frameUrls[0], story: frameUrls[1]||frameUrls[0], landscape: frameUrls[2]||frameUrls[0]} :
      {square: pi.instagram_feed, story: pi.instagram_story, landscape: pi.facebook_post};
    const proxyRes = await fetch(MKT_SB_URL + '/functions/v1/gif-generator', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'fetch_images_b64', calendar_id: parseInt(calendarId), urls: slideUrls })
    });
    const proxyData = await proxyRes.json();
    if (!proxyData.ok) throw new Error('Image fetch failed: ' + (proxyData.error||JSON.stringify(proxyData).slice(0,100)));

    const formatResults = {};
    for (const fmt of GIF_FORMATS) {
      const b64 = proxyData.images?.[fmt.key];
      if (!b64) { console.warn('No image data for', fmt.key); continue; }
      formatResults[fmt.key] = { b64, fmt };
    }
    if (!Object.keys(formatResults).length) throw new Error('Could not load any poster images for GIF encoding');

    // STEP 3: Encode ONE square GIF crossfading all 3 slide images
    const loadImg = b64 => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej;
      i.src = 'data:image/png;base64,' + b64;
    });

    const _gifencResp = await fetch('/assets/gifenc-worker.js');
    if (!_gifencResp.ok) throw new Error('gifenc load failed: HTTP ' + _gifencResp.status);
    const libSrc = await _gifencResp.text();

    // Encode 3 separate GIFs: square, story, landscape
    // Each GIF crossfades 3 slides of same design
    const GIF_CONFIGS = [
      { key:'square',    gifW:720, gifH:720,  urlKey:'gif_slides_square' },
      { key:'story',     gifW:480, gifH:854,  urlKey:'gif_slides_story' },
      { key:'landscape', gifW:854, gifH:480,  urlKey:'gif_slides_landscape' },
    ];

    for (const gifCfg of GIF_CONFIGS) {
      const slideUrlsStr = pi[gifCfg.urlKey] || '';
      const slideUrls = slideUrlsStr.split('|').filter(Boolean);
      if (!slideUrls.length) { console.warn('No slide URLs for', gifCfg.key); continue; }

      // Fetch all slide images for this format
      showMktToast('⏳ Fetching ' + gifCfg.key + ' slides…', 5000);
      const fmtProxyRes = await fetch(MKT_SB_URL + '/functions/v1/gif-generator', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
        body: JSON.stringify({ action: 'fetch_images_b64', urls: Object.fromEntries(slideUrls.map((u,i) => ['s'+(i+1), u])) })
      });
      const fmtProxy = await fmtProxyRes.json();
      if (!fmtProxy.ok) { console.warn('Fetch failed for', gifCfg.key); continue; }

      const allB64s = Object.values(fmtProxy.images || {}).filter(Boolean);
      if (!allB64s.length) continue;

      const fmt = { key: gifCfg.key, gifW: gifCfg.gifW, gifH: gifCfg.gifH };
      const r = { b64: allB64s[0], fmt };
      showMktToast('⏳ Encoding ' + gifCfg.key + ' GIF (' + allB64s.length + ' slides)…', 5000);

      try {
        // Load all frames as images
        const imgs = await Promise.all(allB64s.map(b64 => loadImg(b64)));
        const W = fmt.gifW, H = fmt.gifH;
        const DELAY = 100; // 100ms per frame = 10fps
        const HOLD_FRAMES = 20;  // 2s per slide
        const FADE_FRAMES = 8;   // 0.8s crossfade

        const can = document.createElement('canvas'); can.width = W; can.height = H;
        const ctx = can.getContext('2d');

        // Load all slide images
        const slideImgs = await Promise.all(allB64s.map(b => loadImg(b)));

        // Build frames: for each slide show HOLD then FADE to next
        const frames = [];

        for (let si = 0; si < slideImgs.length; si++) {
          const imgA = slideImgs[si];
          const imgB = slideImgs[(si + 1) % slideImgs.length];

          // Draw imgA scaled to fill canvas
          const drawImg = (img, alpha) => {
            const sc = Math.min(W / img.naturalWidth, H / img.naturalHeight);
            const iW = img.naturalWidth * sc, iH = img.naturalHeight * sc;
            const iX = (W - iW) / 2, iY = (H - iH) / 2;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = alpha;
            ctx.drawImage(img, iX, iY, iW, iH);
            ctx.globalAlpha = 1;
          };

          // Hold frames — show slide fully
          for (let f = 0; f < HOLD_FRAMES; f++) {
            drawImg(imgA, 1);
            frames.push({ data: Array.from(ctx.getImageData(0, 0, W, H).data), delay: DELAY });
          }

          // Fade frames — crossfade to next slide
          for (let f = 0; f < FADE_FRAMES; f++) {
            const t = f / FADE_FRAMES;
            drawImg(imgA, 1 - t);
            const dataA = ctx.getImageData(0, 0, W, H).data;
            drawImg(imgB, t);
            const dataB = ctx.getImageData(0, 0, W, H).data;
            // Blend
            const blended = new Uint8ClampedArray(dataA.length);
            for (let p = 0; p < dataA.length; p++) blended[p] = Math.round(dataA[p] * (1-t) + dataB[p] * t);
            ctx.putImageData(new ImageData(blended, W, H), 0, 0);
            frames.push({ data: Array.from(ctx.getImageData(0, 0, W, H).data), delay: DELAY });
          }
        }

        r.gifBlob = await new Promise((resolve, reject) => {
          const worker = new Worker(workerUrl);
          worker.onmessage = e => {
            if (e.data.type === 'progress') showMktToast('⏳ ' + fmt.label + ' GIF ' + e.data.pct + '%…', 3000);
            else if (e.data.type === 'done') {
              worker.terminate(); URL.revokeObjectURL(workerUrl); URL.revokeObjectURL(libUrl);
              resolve(new Blob([e.data.buffer], { type: 'image/gif' }));
            }
          };
          worker.onerror = e => { worker.terminate(); reject(new Error('GIF encode: ' + (e.message||e.type))); };
          worker.postMessage({ frames, width: W, height: H });
        });
      } catch(e) { console.warn('GIF encode failed for', key, e); r.gifError = e.message; }
    }

    // For slideshow mode: Railway created MP4s, browser GIF encoding not needed
    // Save static PNGs already in pi, use Railway MP4 URLs already saved
    // Just finalize the calendar record
    const slideshowToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const slideshowExpires = new Date(Date.now() + 48*3600*1000).toISOString();
    const primaryUrl = pi.instagram_feed || pi.square_gif || pi.gif || frameUrls[0];

    await sb.from('content_calendar').update({
      image_url: primaryUrl,
      platform_images: pi,
      status: 'ready',
      approval_token: slideshowToken,
      approval_token_expires_at: slideshowExpires,
      post_time: '10:00',
      updated_at: new Date().toISOString()
    }).eq('id', calendarId);

    clearInterval(ticker);
    const hasMp4 = !!(pi.instagram_feed_mp4 || pi.mp4_music);
    showMktNotif('✅ Slideshow ready! ' + (hasMp4 ? 'MP4 created via Railway ✅' : 'Static images only — MP4 may still be processing') + ' — approval email sent');
    saveToHistory(calendarId, 'gif_slideshow', {
      image_url: primaryUrl,
      platform_images: pi,
      prompt_summary: 'Slideshow GIF — 3 themes via gif-generator + Railway MP4'
    });
    renderCalendar();

    // STEP 4+5: Upload each format GIF + static posters, save all URLs to platform_images
    showMktToast('⏳ Uploading…', 5000);
    const ts = Date.now();
    const platformImages = {};
    let primaryGifUrl = null;
    let totalKb = 0;

    for (const key of Object.keys(formatResults)) {
      const r = formatResults[key];
      const fmt = r.fmt;

      // Upload static poster (PNG)
      try {
        const pngBytes = Uint8Array.from(atob(r.b64), c => c.charCodeAt(0));
        const pngPath = 'calendar/' + calendarId + '_gif_' + key + '_' + ts + '.png';
        const { error: pe } = await sb.storage.from('calendar-images').upload(pngPath, pngBytes, { contentType: 'image/png', upsert: true });
        if (!pe) {
          const { data: pp } = sb.storage.from('calendar-images').getPublicUrl(pngPath);
          fmt.channels.forEach(ch => { platformImages[ch] = pp.publicUrl; });
        }
      } catch(e) { console.warn('PNG upload failed', key, e); }

      // Upload GIF
      if (r.gifBlob) {
        try {
          const gifBytes = new Uint8Array(await r.gifBlob.arrayBuffer());
          const gifPath = 'gif-calendar/' + calendarId + '_' + key + '_' + ts + '.gif';
          const { error: ge } = await sb.storage.from('calendar-images').upload(gifPath, gifBytes, { contentType: 'image/gif', upsert: true });
          if (!ge) {
            const { data: gp } = sb.storage.from('calendar-images').getPublicUrl(gifPath);
            platformImages[key + '_gif'] = gp.publicUrl;
            if (key === 'square') primaryGifUrl = gp.publicUrl;
            totalKb += Math.round(r.gifBlob.size / 1024);
          }
        } catch(e) { console.warn('GIF upload failed', key, e); }
      }
    }

    if (!primaryGifUrl) primaryGifUrl = platformImages['instagram_feed'] || Object.values(platformImages)[0];

    // Save to calendar with all format URLs
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const expires = new Date(Date.now() + 48*3600*1000).toISOString();
    platformImages['gif'] = primaryGifUrl; // primary GIF reference

    await sb.from('content_calendar').update({
      image_url: primaryGifUrl,
      platform_images: platformImages,
      status: 'ready',
      approval_token: token,
      approval_token_expires_at: expires,
      post_time: '10:00',
      updated_at: new Date().toISOString()
    }).eq('id', calendarId);

    // Send approval email
    try {
      await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
        body: JSON.stringify({ action: 'send_approval_notification', calendar_id: parseInt(calendarId) })
      });
    } catch(e) { console.log('Email send failed:', e); }

    clearInterval(ticker);
    showMktNotif('✅ GIFs ready! (' + totalKb + ' KB total across ' + Object.keys(formatResults).length + ' formats) — approval email sent');
    saveToHistory(calendarId, 'gif_slideshow', {
      image_url: primaryGifUrl,
      platform_images: platformImages,
      prompt_summary: 'Poster Slideshow GIF — ' + Object.keys(formatResults).length + ' formats'
    });
    renderCalendar();

  } catch(e) {
    clearInterval(ticker);
    showMktNotif('❌ GIF generation failed: ' + e.message);
    if (btn) { btn.innerHTML = '✨ Generate GIF'; btn.disabled = false; }
    renderCalendar();
  }
}

async function calGenerateGifAnimated(calendarId, offerText, animStyle, musicId) {
  const btn = document.getElementById(`gif-btn-${calendarId}`);
  if (btn) { btn.innerHTML = '⏳'; btn.disabled = true; }
  let secs = 0;
  showMktToast('⏳ Generating Animated Poster GIF…', 5000);
  const ticker = setInterval(() => { secs += 3; showMktToast('⏳ Animated GIF… ' + secs + 's', 5000); }, 3000);
  const musicURL = musicId ? mktGetMusicURL(musicId) : null;

  try {
    // Generate captions
    const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
    if (!item) throw new Error('Item not found');

    if (!item.caption) {
      showMktToast('⏳ Generating caption…', 5000);
      const br = await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({ action:'generate_brief', brief:[item.topic,item.notes].filter(Boolean).join('. '), tone:'product' })
      });
      const bd = await br.json();
      if (bd.ok) await sb.from('content_calendar').update({
        caption:bd.content.caption_en, caption_te:bd.content.caption_te,
        hashtags:(bd.content.hashtags||'').split(' ').filter(h=>h.startsWith('#')),
        poster_message:bd.content.poster_message||'', updated_at:new Date().toISOString()
      }).eq('id',calendarId);
    }

    // Animated GIF: ALWAYS generate a fresh poster as the background
    // This ensures a clean new design — not the old poster with overlaid text
    const { data: reloadedItem } = await sb.from('content_calendar').select('*').eq('id',calendarId).single();
    const posterMsg = reloadedItem?.poster_message || reloadedItem?.topic || item.topic;
    // Clean topic — remove "GIF", "Comparison", "Slideshow" etc from prompt to avoid AI rendering it as text
    const cleanTopic = item.topic
      .replace(/\s*[—–-]\s*(GIF|Slideshow|Comparison|Animation|Animated|Video|Reel)\s*/gi, '')
      .replace(/\b(GIF|Slideshow|Comparison|Animation|Animated)\b/gi, '')
      .replace(/\s{2,}/g, ' ').trim();
    const headline = reloadedItem?.poster_message || cleanTopic;

    const tl = item.topic.toLowerCase();
    const scheme = tl.includes('granite')||tl.includes('tile')||tl.includes('marble')
      ? 'elegant cream and charcoal with natural stone textures and warm wood tones'
      : tl.includes('paint') ? 'warm terracotta and sage green palette'
      : tl.includes('bathroom')||tl.includes('sanitaryware') ? 'clean white and chrome with soft spa lighting'
      : 'warm professional cream and charcoal';

    // Generate 3 format posters via content-pipeline (fast, ~90s each, no timeout)
    const GIF_FORMATS_ANIM = [
      { key:'square', size:'1024x1024', gifW:720, gifH:720,
        prompt:`Premium marketing poster for V Wholesale home building store, Vijayawada India. ${scheme}. Indian lifestyle interior photo for ${cleanTopic}. Include: V Wholesale brand, Build Better Pay Less tagline, headline ${headline}, Tiles Granite Sanitaryware Paints Plywood Furniture category icons, phone +91 8712697930 vwholesale.in footer. Square format.`
      },
      { key:'story', size:'1024x1536', gifW:480, gifH:720,
        prompt:`Premium vertical Instagram Story poster for V Wholesale, Vijayawada. ${scheme}. Indian interior for ${cleanTopic}. V Wholesale branding top, headline ${headline}, category strip, +91 8712697930 vwholesale.in footer. 9:16 vertical format.`
      },
      { key:'landscape', size:'1536x1024', gifW:720, gifH:480,
        prompt:`Premium landscape Facebook poster for V Wholesale, Vijayawada. ${scheme}. Text left side: V Wholesale, headline ${headline}. Indian interior photo right side for ${cleanTopic}. Category strip, +91 8712697930 vwholesale.in footer. 16:9 landscape.`
      },
    ]
    const animPosterB64s = {};
    const animErrors = [];
    for (const fmt of GIF_FORMATS_ANIM) {
      showMktToast('⏳ Generating ' + fmt.key + ' poster…', 5000);
      try {
        const res = await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({ action:'generate_poster_image', prompt:fmt.prompt, size:fmt.size })
        });
        const d = await res.json();
        if (d.ok && d.b64) {
          animPosterB64s[fmt.key] = { b64:d.b64, fmt };
        } else {
          const err = (d.error || 'No image returned') + ' (HTTP ' + res.status + ')';
          animErrors.push(fmt.key + ': ' + err);
          console.warn('Poster failed for', fmt.key, err);
        }
      } catch(e) {
        animErrors.push(fmt.key + ': ' + e.message);
        console.warn('Poster error for', fmt.key, e);
      }
    }

    if (!Object.keys(animPosterB64s).length) {
      throw new Error('Poster generation failed: ' + animErrors.join('; '));
    }

    const pi_item = reloadedItem;

    // Load gifenc
    const libResp = await fetch('/assets/gifenc-worker.js');
    if (!libResp.ok) throw new Error('gifenc load failed');
    const libSrc = await libResp.text();

    const loadImgB64 = b64 => new Promise((res,rej) => {
      const i = new Image();
      i.onload=()=>res(i); i.onerror=rej;
      i.src='data:image/png;base64,' + b64;
    });

    const ts = Date.now();
    const platformImages = { ...(pi_item?.platform_images||{}) };
    let totalKb = 0;

    for (const key of Object.keys(animPosterB64s)) {
      const { b64, fmt } = animPosterB64s[key];
      showMktToast('⏳ Animating ' + key + ' GIF…', 5000);

      try {
        const img = await loadImgB64(b64);
        const W = fmt.gifW, H = fmt.gifH;
        const DELAY = 80; // ~12fps
        const FADE = 8, HOLD = 36; // 0.64s fade, 2.88s hold
        const TOTAL = HOLD + FADE * 2;

        const can = document.createElement('canvas'); can.width=W; can.height=H;
        const ctx = can.getContext('2d');
        const headline = pi_item?.poster_message || pi_item?.topic || item.topic || '';
        const isCinematic = (animStyle||'cinematic') === 'cinematic';
        const baseScale = Math.min(W/img.naturalWidth, H/img.naturalHeight);
        const bW = img.naturalWidth*baseScale, bH = img.naturalHeight*baseScale;
        const bX = (W-bW)/2, bY = (H-bH)/2;

        const frames = [];
        for (let f = 0; f < TOTAL; f++) {
          const t = f/(TOTAL-1);
          const fadeAlpha = f<FADE ? f/FADE : f>TOTAL-FADE ? (TOTAL-f)/FADE : 1;
          const textT = f<FADE ? 0 : Math.min(1,(f-FADE)/(HOLD*0.6));

          ctx.clearRect(0,0,W,H);

          // Draw full AI poster with Ken Burns zoom (poster IS the complete design)
          const zoom = isCinematic ? (1.0 + 0.05*t) : 1.0;
          const sw = bW*zoom, sh = bH*zoom;
          ctx.drawImage(img, bX-(sw-bW)/2, bY-(sh-bH)/2, sw, sh);

          // Energetic: pulsing gold border
          if (!isCinematic) {
            const pulse = 0.4 + 0.6*Math.sin(t*Math.PI*6);
            ctx.strokeStyle = 'rgba(201,168,76,' + (0.3+0.7*pulse) + ')';
            ctx.lineWidth = Math.round(W*0.01);
            ctx.strokeRect(ctx.lineWidth/2, ctx.lineWidth/2, W-ctx.lineWidth, H-ctx.lineWidth);
          }

          // Badge removed — AI poster already has price baked in

          // Global fade in/out
          if (fadeAlpha < 1) {
            ctx.fillStyle = 'rgba(0,0,0,' + (1-fadeAlpha) + ')';
            ctx.fillRect(0,0,W,H);
          }

          frames.push({ data:Array.from(ctx.getImageData(0,0,W,H).data), delay:DELAY });
        }

        // Encode
        const wfn='self.onmessage=function(e){var f=e.data.frames,w=e.data.width,h=e.data.height,g=GIFEncoder();f.forEach(function(fr,i){var d=new Uint8ClampedArray(fr.data),p=quantize(d,256),ix=applyPalette(d,p);g.writeFrame(ix,w,h,{palette:p,delay:fr.delay,dispose:2});if(i%5===0)self.postMessage({type:"progress",pct:Math.round(i/f.length*100)});});g.finish();var b=g.bytes();self.postMessage({type:"done",buffer:b.buffer},[b.buffer]);};';
        const lBlob=new Blob([libSrc],{type:'application/javascript'});
        const lUrl=URL.createObjectURL(lBlob);
        const wUrl=URL.createObjectURL(new Blob(['importScripts("'+lUrl+'");\n'+wfn],{type:'application/javascript'}));
        const gifBlob = await new Promise((resolve,reject) => {
          const worker=new Worker(wUrl);
          worker.onmessage=e=>{
            if(e.data.type==='progress') showMktToast('⏳ Encoding '+key+'… '+e.data.pct+'%',3000);
            else if(e.data.type==='done'){worker.terminate();URL.revokeObjectURL(wUrl);URL.revokeObjectURL(lUrl);resolve(new Blob([e.data.buffer],{type:'image/gif'}));}
          };
          worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};
          worker.postMessage({frames,width:W,height:H});
        });

        const gifBytes=new Uint8Array(await gifBlob.arrayBuffer());
        const gifPath='gif-calendar/'+calendarId+'_animated_'+key+'_'+ts+'.gif';
        const {error:ge}=await sb.storage.from('calendar-images').upload(gifPath,gifBytes,{contentType:'image/gif',upsert:true});
        if (!ge) {
          const {data:gp}=sb.storage.from('calendar-images').getPublicUrl(gifPath);
          platformImages[key+'_gif']=gp.publicUrl;
          if (key==='square') {
            platformImages['gif']=gp.publicUrl;
            platformImages['square_gif']=gp.publicUrl;
          }
          if (key==='story') platformImages['story_gif']=gp.publicUrl;
          if (key==='landscape') platformImages['landscape_gif']=gp.publicUrl;
          totalKb+=Math.round(gifBlob.size/1024);
        }

        // Also upload static PNG for non-GIF channels
        try {
          const pngBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const pngPath = 'calendar/'+calendarId+'_anim_'+key+'_'+ts+'.png';
          const {error:pe}=await sb.storage.from('calendar-images').upload(pngPath,pngBytes,{contentType:'image/png',upsert:true});
          if (!pe) {
            const {data:pp}=sb.storage.from('calendar-images').getPublicUrl(pngPath);
            if (key==='square') { platformImages['instagram_feed']=pp.publicUrl; platformImages['threads']=pp.publicUrl; }
            if (key==='story') { platformImages['instagram_story']=pp.publicUrl; platformImages['facebook_story']=pp.publicUrl; platformImages['whatsapp_story']=pp.publicUrl; }
            if (key==='landscape') { platformImages['facebook_post']=pp.publicUrl; platformImages['youtube']=pp.publicUrl; platformImages['gbp']=pp.publicUrl; }
          }
        } catch(e) { console.warn('PNG upload failed', key, e); }

        // Create MP4 for Instagram/Facebook (GIF shows black on these platforms)
        try {
          if (musicURL || key === 'square' || key === 'landscape') {
            showMktToast('⏳ Creating MP4 for '+key+'…', 5000);
            const srcUrl = 'data:image/png;base64,'+b64;
            const mp4Blob = await mktExportMP4WithMusic(srcUrl, [], animStyle||'cinematic', musicURL||null, W, H, null);
            if (mp4Blob) {
              const mp4Bytes = new Uint8Array(await mp4Blob.arrayBuffer());
              const ext = mp4Blob.type.includes('mp4') ? 'mp4' : 'webm';
              const mp4Path = 'gif-calendar/'+calendarId+'_anim_'+key+'_'+ts+'.'+ext;
              const {error:me} = await sb.storage.from('calendar-images').upload(mp4Path, mp4Bytes, {contentType:mp4Blob.type, upsert:true});
              if (!me) {
                const {data:mp} = sb.storage.from('calendar-images').getPublicUrl(mp4Path);
                if (key==='square') {
                  platformImages['instagram_feed_mp4'] = mp.publicUrl;
                  platformImages['threads_mp4'] = mp.publicUrl;
                  platformImages['mp4_music'] = mp.publicUrl;
                }
                if (key==='story') {
                  platformImages['instagram_story_mp4'] = mp.publicUrl;
                  platformImages['facebook_story_mp4'] = mp.publicUrl;
                }
                if (key==='landscape') {
                  platformImages['facebook_post_mp4'] = mp.publicUrl;
                  platformImages['youtube_mp4'] = mp.publicUrl;
                }
                totalKb += Math.round(mp4Blob.size/1024);
              }
            }
          }
        } catch(mp4Err) { console.warn('MP4 encode failed for', key, mp4Err); }

      } catch(e) { console.warn('Animated GIF failed for',fmt.key,e); }
    }

    // Save music attribution so Post Now can auto-append it
    if (musicURL) {
      const musicTrack = MKT_MUSIC_TRACKS.find(t => mktGetMusicURL(t.id) === musicURL);
      if (musicTrack?.attribution) platformImages['music_attribution'] = musicTrack.attribution;
      if (musicTrack?.id) platformImages['music_track_id'] = musicTrack.id;
    }

    // Save
    const token=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    const expires=new Date(Date.now()+48*3600*1000).toISOString();
    await sb.from('content_calendar').update({
      image_url:platformImages['gif']||platformImages['instagram_feed'],
      platform_images:platformImages, status:'ready',
      approval_token:token, approval_token_expires_at:expires,
      post_time:'10:00', updated_at:new Date().toISOString()
    }).eq('id',calendarId);

    try {
      await fetch(MKT_SB_URL+'/functions/v1/content-pipeline',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'send_approval_notification',calendar_id:parseInt(calendarId)})});
    } catch(e) {}

    clearInterval(ticker);
    showMktNotif('✅ Animated GIF ready! ('+totalKb+' KB) — '+animStyle+' style — approval email sent');
    saveToHistory(calendarId, 'gif_animated', {
      image_url: platformImages['gif'] || platformImages['instagram_feed'],
      platform_images: platformImages,
      anim_style: animStyle,
      offer_text: offerText,
      prompt_summary: 'Animated Poster GIF — ' + animStyle + (offerText ? ' — offer: ' + offerText : '')
    });
    renderCalendar();

  } catch(e) {
    clearInterval(ticker);
    showMktNotif('❌ Animated GIF failed: '+e.message);
    if (btn) { btn.innerHTML='✨ Generate GIF'; btn.disabled=false; }
    renderCalendar();
  }
}


// Non-destructive: original poster always preserved
// primary_content_type tracks what to show; static_poster_id preserved

// ── EDIT OFFER BADGE — re-encode from existing posters, ZERO API cost ──
async function calEditOfferBadge(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktNotif('❌ Post not found'); return; }
  const currentOffer = item.platform_images?.offer_text || '';

  const pop = document.createElement('div');
  pop.id = 'edit-offer-popup';
  pop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  pop.innerHTML = `
    <div style="background:#1e293b;border-radius:14px;padding:24px;max-width:380px;width:100%;border:1px solid #334155">
      <div style="font-size:16px;font-weight:900;color:#f1f5f9;margin-bottom:4px">✏️ Edit Offer Badge</div>
      <div style="font-size:11px;color:#22c55e;margin-bottom:16px">✅ FREE — re-encodes from existing poster, zero AI cost</div>
      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:700;color:#94a3b8;display:block;margin-bottom:6px">💰 OFFER / PRICE TEXT</label>
        <input id="edit-offer-input" type="text" value="${currentOffer}"
          placeholder="e.g. Starts @ ₹59/SFT  ·  20% OFF  ·  Free Delivery"
          style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 12px;color:#f1f5f9;font-size:13px;box-sizing:border-box;outline:none">
        <div style="font-size:10px;color:#475569;margin-top:4px">Leave blank to remove badge</div>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:700;color:#94a3b8;display:block;margin-bottom:8px">🎨 ANIMATION STYLE</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label id="eo-cinematic" style="background:#0f172a;border:2px solid #c9a84c;border-radius:8px;padding:8px;cursor:pointer;text-align:center">
            <input type="radio" name="eo-style" value="cinematic" checked style="display:none">
            <div style="font-size:13px;margin-bottom:2px">🎬</div>
            <div style="font-size:10px;font-weight:700;color:#c9a84c">Cinematic</div>
          </label>
          <label id="eo-energetic" style="background:#0f172a;border:2px solid #334155;border-radius:8px;padding:8px;cursor:pointer;text-align:center">
            <input type="radio" name="eo-style" value="energetic" style="display:none">
            <div style="font-size:13px;margin-bottom:2px">⚡</div>
            <div style="font-size:10px;font-weight:700;color:#f1f5f9">Energetic</div>
          </label>
        </div>
      </div>
      <div id="eo-music-picker"><div style="font-size:12px;color:#64748b;padding:8px">⏳ Loading music…</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button onclick="document.getElementById('edit-offer-popup').remove()"
          style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:10px;border-radius:8px;cursor:pointer;font-size:13px">Cancel</button>
        <button onclick="calApplyOfferBadge('${calendarId}')"
          style="background:#c9a84c;border:none;color:#111;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">✨ Re-encode GIF</button>
      </div>
    </div>`;

  pop.querySelectorAll('input[name="eo-style"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('eo-cinematic').style.borderColor = '#334155';
      document.getElementById('eo-energetic').style.borderColor = '#334155';
      document.getElementById('eo-' + r.value).style.borderColor = '#c9a84c';
    });
  });
  pop.addEventListener('click', e => { if (e.target === pop) pop.remove(); });
  document.body.appendChild(pop);
  // Load music picker async after popup is in DOM
  loadMusicTracks().then(() => {
    const picker = document.getElementById('eo-music-picker');
    if (picker) picker.innerHTML = mktMusicPickerHTML('none');
  });
  mktBindMusicPicker();
  setTimeout(() => document.getElementById('edit-offer-input')?.focus(), 100);
}

// Re-encode GIF from existing poster frames with NO badge overlay — cleans double-badge issue
// Internal: re-encode with specific offer text (empty = no badge)
async function calApplyOfferBadge(calendarId) {
  const newOffer = document.getElementById('edit-offer-input')?.value.trim() || '';
  const animStyle = document.querySelector('input[name="eo-style"]:checked')?.value || 'cinematic';
  const musicId = (document.getElementById('mkt-music-value')?.value || document.getElementById('mkt-music-select')?.value || 'none');
  document.getElementById('edit-offer-popup')?.remove();
  await calApplyOfferBadge_internal(calendarId, newOffer, animStyle, musicId);
}
window.calApplyOfferBadge = calApplyOfferBadge;

async function calApplyOfferBadge_internal(calendarId, newOffer, animStyle, musicId) {
  const musicTrack = MKT_MUSIC_TRACKS.find(t => t.id === (musicId||'none'));
  const musicURL = mktGetMusicURL(musicId||'none');
  const hasMusic = !!musicURL;
  document.getElementById('edit-offer-popup')?.remove();

  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktNotif('❌ Post not found'); return; }
  const pi = item.platform_images || {};
  if (!pi.instagram_feed && !pi.instagram_story && !pi.facebook_post) {
    showMktNotif('❌ No poster images found — generate the animated GIF first');
    return;
  }

  let secs = 0;
  const exportLabel = hasMusic ? 'MP4 video with music' : 'GIF';
  showMktToast('⏳ Re-encoding ' + exportLabel + '… 0s (zero AI cost)', 5000);
  const ticker = setInterval(() => { secs += 3; showMktToast('⏳ Re-encoding ' + exportLabel + '… ' + secs + 's', 5000); }, 3000);

  try {
    const libResp = await fetch('/assets/gifenc-worker.js');
    if (!libResp.ok) throw new Error('gifenc load failed');
    const libSrc = await libResp.text();
    const loadImgUrl = url => new Promise((res, rej) => {
      const i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });

    const FORMATS = [
      { key:'square',    gifW:720, gifH:720, staticKey:'instagram_feed',  gifKey:'square_gif'    },
      { key:'story',     gifW:480, gifH:720, staticKey:'instagram_story', gifKey:'story_gif'     },
      { key:'landscape', gifW:720, gifH:480, staticKey:'facebook_post',   gifKey:'landscape_gif' },
    ];

    const ts = Date.now();
    const newPI = { ...pi, offer_text: newOffer };
    let totalKb = 0;
    const isCinematic = animStyle === 'cinematic';

    for (const fmt of FORMATS) {
      const srcUrl = pi[fmt.staticKey]; if (!srcUrl) continue;
      showMktToast('⏳ Re-encoding ' + fmt.key + '…', 5000);
      try {
        const img = await loadImgUrl(srcUrl);
        const W = fmt.gifW, H = fmt.gifH;
        const DELAY=80, FADE=8, HOLD=36, TOTAL=HOLD+FADE*2;
        const bs = Math.min(W/img.naturalWidth, H/img.naturalHeight);
        const bW=img.naturalWidth*bs, bH=img.naturalHeight*bs;
        const bX=(W-bW)/2, bY=(H-bH)/2;
        const can=document.createElement('canvas'); can.width=W; can.height=H;
        const ctx=can.getContext('2d');
        const frames=[];

        for (let f=0; f<TOTAL; f++) {
          const t=f/(TOTAL-1);
          const fadeAlpha=f<FADE?f/FADE:f>TOTAL-FADE?(TOTAL-f)/FADE:1;
          const textT=f<FADE?0:Math.min(1,(f-FADE)/(HOLD*0.6));
          ctx.clearRect(0,0,W,H);
          const zoom=isCinematic?1.0+0.05*t:1.0;
          ctx.drawImage(img, bX-(bW*(zoom-1)/2), bY-(bH*(zoom-1)/2), bW*zoom, bH*zoom);
          if (!isCinematic) {
            const pulse=0.4+0.6*Math.sin(t*Math.PI*6);
            ctx.strokeStyle='rgba(201,168,76,'+(0.3+0.7*pulse)+')';
            ctx.lineWidth=Math.round(W*0.01);
            ctx.strokeRect(ctx.lineWidth/2,ctx.lineWidth/2,W-ctx.lineWidth,H-ctx.lineWidth);
          }
          if (newOffer && textT>0.35) {
            const popT=Math.min(1,(textT-0.35)/0.4);
            const bounce=isCinematic?(popT<0.65?popT/0.65:1+0.1*Math.sin((popT-0.65)/0.35*Math.PI)):(popT<0.6?popT/0.6:1+0.2*Math.sin((popT-0.6)/0.4*Math.PI));
            ctx.save();
            ctx.font='bold '+Math.round(W*0.055)+'px Arial';
            const bW2=Math.min(W*0.72,ctx.measureText(newOffer).width+W*0.1);
            const bH2=Math.round(W*0.1);
            ctx.translate(W/2, H*0.75+(1-bounce)*H*0.08);
            ctx.scale(bounce<1?bounce:1,bounce<1?bounce:1);
            ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=Math.round(W*0.025); ctx.shadowOffsetY=Math.round(W*0.008);
            ctx.fillStyle='#C9A84C'; ctx.beginPath(); ctx.roundRect(-bW2/2,-bH2/2,bW2,bH2,bH2*0.3); ctx.fill();
            ctx.shadowBlur=0; ctx.shadowOffsetY=0;
            ctx.fillStyle='#111'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(newOffer,0,0); ctx.textBaseline='alphabetic'; ctx.textAlign='left'; ctx.restore();
          }
          if (fadeAlpha<1) { ctx.fillStyle='rgba(0,0,0,'+(1-fadeAlpha)+')'; ctx.fillRect(0,0,W,H); }
          frames.push({ data:Array.from(ctx.getImageData(0,0,W,H).data), delay:DELAY });
        }

        const wfn='self.onmessage=function(e){var f=e.data.frames,w=e.data.width,h=e.data.height,g=GIFEncoder();f.forEach(function(fr,i){var d=new Uint8ClampedArray(fr.data),p=quantize(d,256),ix=applyPalette(d,p);g.writeFrame(ix,w,h,{palette:p,delay:fr.delay,dispose:2});if(i%5===0)self.postMessage({type:"progress",pct:Math.round(i/f.length*100)});});g.finish();var b=g.bytes();self.postMessage({type:"done",buffer:b.buffer},[b.buffer]);};';
        const lUrl=URL.createObjectURL(new Blob([libSrc],{type:'application/javascript'}));
        const wUrl=URL.createObjectURL(new Blob(['importScripts("'+lUrl+'");\n'+wfn],{type:'application/javascript'}));
        const gifBlob = await new Promise((resolve,reject)=>{
          const worker=new Worker(wUrl);
          worker.onmessage=e=>{
            if(e.data.type==='progress') showMktToast('⏳ Encoding '+fmt.key+'… '+e.data.pct+'%',3000);
            else if(e.data.type==='done'){worker.terminate();URL.revokeObjectURL(wUrl);URL.revokeObjectURL(lUrl);resolve(new Blob([e.data.buffer],{type:'image/gif'}));}
          };
          worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};
          worker.postMessage({frames,width:W,height:H});
        });

        const gifBytes=new Uint8Array(await gifBlob.arrayBuffer());
        const gifPath='gif-calendar/'+calendarId+'_edited_'+fmt.key+'_'+ts+'.gif';
        const {error:ge}=await sb.storage.from('calendar-images').upload(gifPath,gifBytes,{contentType:'image/gif',upsert:true});
        if(!ge){
          const {data:gp}=sb.storage.from('calendar-images').getPublicUrl(gifPath);
          newPI[fmt.key+'_gif']=gp.publicUrl;
          if(fmt.key==='square'){newPI['gif']=gp.publicUrl; newPI['square_gif']=gp.publicUrl;}
          if(fmt.key==='story') newPI['story_gif']=gp.publicUrl;
          if(fmt.key==='landscape') newPI['landscape_gif']=gp.publicUrl;
          totalKb+=Math.round(gifBlob.size/1024);
        }
      } catch(e){ console.warn('Re-encode failed for',fmt.key,e); }
    }

    await sb.from('content_calendar').update({
      image_url: newPI['gif']||newPI['instagram_feed'],
      platform_images: newPI, updated_at: new Date().toISOString()
    }).eq('id',calendarId);

    // If music selected, also export MP4 for square format
    if (hasMusic && newPI['instagram_feed']) {
      showMktToast('⏳ Exporting MP4 with music…', 5000);
      try {
        const mp4Blob = await mktExportMP4WithMusic(newPI['instagram_feed'], newOffer, animStyle, musicURL, 720, 720);
        if (mp4Blob) {
          const mp4Bytes = new Uint8Array(await mp4Blob.arrayBuffer());
          const mp4Path = 'gif-calendar/' + calendarId + '_music_' + ts + '.' + (mp4Blob.type.includes('mp4') ? 'mp4' : 'webm');
          const { error: me } = await sb.storage.from('calendar-images').upload(mp4Path, mp4Bytes, { contentType: mp4Blob.type, upsert: true });
          if (!me) {
            const { data: mp } = sb.storage.from('calendar-images').getPublicUrl(mp4Path);
            newPI['mp4_music'] = mp.publicUrl;
            await sb.from('content_calendar').update({ platform_images: newPI, updated_at: new Date().toISOString() }).eq('id', calendarId);
            totalKb += Math.round(mp4Blob.size / 1024);
          }
        }
      } catch(e) { console.warn('MP4 export failed:', e); }
    }

    clearInterval(ticker);
    const msg = hasMusic
      ? '✅ MP4 with ' + musicTrack.label + ' ready (' + totalKb + ' KB) — zero AI cost'
      : '✅ GIF re-encoded (' + totalKb + ' KB) — zero AI cost';
    showMktNotif(msg);
    saveToHistory(calendarId,'gif_animated',{
      image_url:newPI['gif'], platform_images:newPI,
      anim_style:animStyle, offer_text:newOffer,
      prompt_summary:'Edited offer badge: '+(newOffer||'removed')
    });
    renderCalendar();
  } catch(e) {
    clearInterval(ticker);
    showMktNotif('❌ Re-encode failed: '+e.message);
  }
}

// ── POSTER EDITOR — per-format independent layers, auto-save ──
// Each format (square/story/landscape) has its own elements array
// Switching formats saves current + loads target independently

let _editorCalendarId = null;
let _editorFormats = {
  square:    { key:'square',    label:'1:1 Feed',    w:480, h:480,  nativeW:1024, nativeH:1024, imgKey:'instagram_feed',  elements:[] },
  story:     { key:'story',     label:'9:16 Story',  w:320, h:480,  nativeW:1024, nativeH:1536, imgKey:'instagram_story', elements:[] },
  landscape: { key:'landscape', label:'16:9 FB/YT',  w:480, h:320,  nativeW:1536, nativeH:1024, imgKey:'facebook_post',   elements:[] },
};
let _editorActive = 'square';
let _editorPI = {};
let _editorIdCounter = 1;
let _editorSelected = null;
let _editorDragging = false;
let _editorResizing = false;
let _editorDragStart = {x:0,y:0};
let _editorCanvas = null;
let _editorCtx = null;
let _editorBgImages = {}; // key → Image object

function editorGetActive() { return _editorFormats[_editorActive]; }

async function calPreviewDraggableBadge(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) return;
  const pi = item.platform_images || {};

  _editorCalendarId = calendarId;
  _editorPI = { ...pi };
  _editorIdCounter = 1;
  _editorSelected = null;

  // Load saved elements
  const saved = pi.editor_elements || {};
  for (const key of Object.keys(_editorFormats)) {
    const fmt = _editorFormats[key];
    if (saved[key] && saved[key].length) {
      fmt.elements = JSON.parse(JSON.stringify(saved[key]));
      const maxId = Math.max(...fmt.elements.map(e => e.id || 0));
      if (maxId >= _editorIdCounter) _editorIdCounter = maxId + 1;
    } else {
      fmt.elements = [];
    }
  }

  // Show editor immediately — images load in parallel in background
  buildEditorPopup();

  // Load all background images in parallel (non-blocking)
  const loadImg = (url) => new Promise(res => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => res(img); img.onerror = () => res(null); img.src = url;
  });
  const keys = Object.keys(_editorFormats);
  const urls = keys.map(k => pi[_editorFormats[k].imgKey] || null);
  const imgs = await Promise.all(urls.map(u => u ? loadImg(u) : Promise.resolve(null)));
  keys.forEach((k, i) => { if (imgs[i]) _editorBgImages[k] = imgs[i]; });

  // Render canvas now that images are loaded
  editorRenderCanvas();
}

async function buildEditorPopup() {
  await loadMusicTracks();
  document.getElementById('badge-editor-popup')?.remove();
  const pop = document.createElement('div');
  pop.id = 'badge-editor-popup';
  pop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#0a0f1a;display:flex;flex-direction:column;font-family:system-ui,sans-serif';

  pop.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#1e293b;border-bottom:1px solid #334155;flex-shrink:0">
      <div style="font-size:14px;font-weight:900;color:#c9a84c">✏️ V Wholesale Poster Editor</div>
      <div style="flex:1"></div>
      <div style="font-size:11px;color:#475569">Changes save automatically</div>
      <button onclick="document.getElementById('badge-editor-popup').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;padding:0 4px">✕</button>
    </div>

    <!-- Format tabs -->
    <div style="display:flex;gap:0;border-bottom:1px solid #334155;flex-shrink:0">
      ${Object.values(_editorFormats).map(f => `
        <button id="ftab-${f.key}" onclick="window.editorSwitchFormat('${f.key}')"
          style="padding:8px 20px;background:${f.key===_editorActive?'#1e293b':'transparent'};border:none;border-bottom:2px solid ${f.key===_editorActive?'#c9a84c':'transparent'};color:${f.key===_editorActive?'#c9a84c':'#64748b'};cursor:pointer;font-size:12px;font-weight:700">
          ${f.label}
        </button>`).join('')}
    </div>

    <div style="display:flex;flex:1;overflow:hidden">

      <!-- LEFT: Canvas -->
      <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#0a0f1a;overflow:auto;padding:20px">
        <div id="editor-wrap" style="position:relative;box-shadow:0 0 40px rgba(0,0,0,.8)">
          <canvas id="editor-canvas" style="display:block"></canvas>
        </div>
      </div>

      <!-- RIGHT: Panel -->
      <div style="width:260px;background:#1e293b;border-left:1px solid #334155;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0">

        <!-- Add elements -->
        <div style="padding:12px;border-bottom:1px solid #334155">
          <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:8px">ADD ELEMENTS</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
            <button onclick="window.editorAdd('badge')" style="background:#0f172a;border:1px solid #334155;color:#c9a84c;padding:7px 4px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700">💰 Price Badge</button>
            <button onclick="window.editorAdd('text')" style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:7px 4px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700">T Text</button>
            <button onclick="window.editorAdd('rect')" style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:7px 4px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700">▬ Box</button>
            <button onclick="window.editorAdd('line')" style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:7px 4px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700">— Line</button>
            <button onclick="window.editorAdd('circle')" style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:7px 4px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700">● Circle</button>
            <button onclick="window.editorAdd('emoji')" style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:7px 4px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700">😊 Emoji</button>
          </div>
          <div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">
            <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:6px">CANVAS SIZE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px">
              <div>
                <div style="font-size:9px;color:#475569;margin-bottom:2px">Width</div>
                <input type="number" id="editor-cw" value="" style="width:100%;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:4px 6px;border-radius:5px;font-size:11px" onchange="window.editorResizeCanvas(+this.value, +document.getElementById('editor-ch').value)">
              </div>
              <div>
                <div style="font-size:9px;color:#475569;margin-bottom:2px">Height</div>
                <input type="number" id="editor-ch" value="" style="width:100%;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:4px 6px;border-radius:5px;font-size:11px" onchange="window.editorResizeCanvas(+document.getElementById('editor-cw').value, +this.value)">
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:3px">
              <button onclick="window.editorResizeCanvas(480,480)" style="background:#0f172a;border:1px solid #334155;color:#64748b;padding:4px;border-radius:5px;cursor:pointer;font-size:10px;text-align:left;padding:5px 8px">▪ Square 1:1 — 480×480</button>
              <button onclick="window.editorResizeCanvas(320,480)" style="background:#0f172a;border:1px solid #334155;color:#64748b;padding:4px;border-radius:5px;cursor:pointer;font-size:10px;text-align:left;padding:5px 8px">▪ Story 9:16 — 320×480</button>
              <button onclick="window.editorResizeCanvas(480,320)" style="background:#0f172a;border:1px solid #334155;color:#64748b;padding:4px;border-radius:5px;cursor:pointer;font-size:10px;text-align:left;padding:5px 8px">▪ Landscape 16:9 — 480×320</button>
              <button onclick="window.editorResizeCanvas(540,540)" style="background:#0f172a;border:1px solid #334155;color:#64748b;padding:4px;border-radius:5px;cursor:pointer;font-size:10px;text-align:left;padding:5px 8px">▪ HD Square — 540×540</button>
              <button onclick="window.editorResizeCanvas(1080,1080)" style="background:#0f172a;border:1px solid #334155;color:#64748b;padding:4px;border-radius:5px;cursor:pointer;font-size:10px;text-align:left;padding:5px 8px">▪ Full HD 1:1 — 1080×1080</button>
            </div>
          </div>
        </div>

        <!-- Elements list -->
        <div style="flex:1;overflow-y:auto;padding:12px">
          <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:8px">LAYERS (this format only)</div>
          <div id="editor-layers"></div>

          <!-- Selected element props -->
          <div id="editor-props" style="display:none;margin-top:12px;border-top:1px solid #334155;padding-top:12px"></div>
        </div>

        <!-- Save/Export -->
        <div style="padding:12px;border-top:1px solid #334155;display:flex;flex-direction:column;gap:6px">
          <select id="editor-music" onchange="window.editorMusicChanged(this)" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:7px;border-radius:6px;font-size:11px"><option value="none">⏳ Loading music…</option></select>
          <div id="editor-music-upload-row" style="display:none;margin-top:4px">
            <input type="file" id="editor-music-file" accept="audio/*,audio/mp3,audio/mpeg"
              style="width:100%;font-size:10px;color:#94a3b8;background:#0f172a;border:1px solid #334155;border-radius:5px;padding:4px"
              onchange="window.editorHandleMusicFile(this)">
          </div>
          <div id="editor-music-status" style="font-size:10px;color:#64748b;margin-top:3px"></div>
          <button onclick="window.editorEncode()"
            style="background:#c9a84c;border:none;color:#111;padding:11px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:900;width:100%">
            ✅ Save &amp; Encode All Formats
          </button>
          <button onclick="window.editorDownloadPNG()"
            style="background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:8px;border-radius:8px;cursor:pointer;font-size:11px;width:100%">
            ⬇ Download this format as PNG
          </button>
        </div>
      </div>
    </div>`;

  document.getElementById('editor-music')?.addEventListener('change', function() {
    const uploadRow = document.getElementById('editor-music-upload-row');
    const status = document.getElementById('editor-music-status');
    if (this.value === '__upload__') {
      uploadRow.style.display = 'block';
    } else {
      uploadRow.style.display = 'none';
      window._editorMusicURL = null;
      if (status) status.textContent = '';
    }
  });

  document.body.appendChild(pop);
  editorInitCanvas();
  editorRenderLayers();
  editorRenderCanvas();

  // Populate music select from DB tracks (popup is now in DOM)
  const moodLabels = {silent:'🔇 No Music',upbeat:'⚡ Upbeat',cinematic:'🎬 Cinematic',energetic:'🔥 Energetic',ambient:'🏠 Ambient',festive:'🎉 Festive',custom:'📁 Custom'};
  const moods = ['silent','upbeat','cinematic','energetic','ambient','festive','custom'];
  function populateEditorMusic() {
    const sel = document.getElementById('editor-music');
    if (!sel) return;
    let html = '';
    moods.forEach(m => {
      const tracks = MKT_MUSIC_TRACKS.filter(t=>t.mood===m);
      if (!tracks.length) return;
      if (m==='silent') { tracks.forEach(t=>{html+='<option value="'+(t.url||'none')+'">'+t.label+'</option>';}); }
      else { html+='<optgroup label="'+(moodLabels[m]||m)+'">'; tracks.forEach(t=>{html+='<option value="'+(t.url||t.id)+'">'+t.label+'</option>';}); html+='</optgroup>'; }
    });
    sel.innerHTML = html || '<option value="none">No Music</option>';
  }
  if (MKT_MUSIC_TRACKS.length > 1) { populateEditorMusic(); }
  else { loadMusicTracks().then(populateEditorMusic); }
}

function editorResizeCanvas(w, h) {
  if (!w || !h || w < 50 || h < 50) return;
  const fmt = editorGetActive();
  fmt.w = w; fmt.h = h;
  _editorCanvas.width = w; _editorCanvas.height = h;
  // Update size display
  const cw = document.getElementById('editor-cw');
  const ch = document.getElementById('editor-ch');
  if (cw) cw.value = w;
  if (ch) ch.value = h;
  // Rescale canvas display
  const maxH = Math.min(window.innerHeight * 0.7, 560);
  const scale = maxH / h;
  _editorCanvas.style.width  = Math.round(w * scale) + 'px';
  _editorCanvas.style.height = Math.round(h * scale) + 'px';
  // Update BG image for new format
  const srcUrl = _editorPI[fmt.imgKey];
  if (srcUrl && !_editorBgImages[_editorActive]) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { _editorBgImages[_editorActive] = img; editorRenderCanvas(); };
    img.src = srcUrl;
  } else {
    editorRenderCanvas();
  }
}
window.editorResizeCanvas = editorResizeCanvas;

function editorInitCanvas() {
  const fmt = editorGetActive();
  _editorCanvas = document.getElementById('editor-canvas');
  _editorCtx = _editorCanvas.getContext('2d');
  // Scale canvas to fit in view (max 60vh height)
  const maxH = Math.min(window.innerHeight * 0.7, 560);
  const scale = maxH / fmt.h;
  _editorCanvas.width = fmt.w;
  _editorCanvas.height = fmt.h;
  _editorCanvas.style.width = Math.round(fmt.w * scale) + 'px';
  _editorCanvas.style.height = Math.round(fmt.h * scale) + 'px';

  // Populate size fields
  const cwEl = document.getElementById('editor-cw');
  const chEl = document.getElementById('editor-ch');
  if (cwEl) cwEl.value = fmt.w;
  if (chEl) chEl.value = fmt.h;

  // Bind events
  _editorCanvas.onmousedown = editorOnDown;
  _editorCanvas.onmousemove = e => {
    editorOnMove(e);
    // Update cursor
    if (!_editorDragging && !_editorResizing && _editorSelected) {
      const p2 = editorGetPos(e);
      const h = editorGetHandlePos(_editorSelected);
      const dist = Math.sqrt((p2.x - h.x)**2 + (p2.y - h.y)**2);
      _editorCanvas.style.cursor = dist < 12 ? 'se-resize' : editorHit(_editorSelected, p2.x, p2.y) ? 'move' : 'default';
    } else if (!_editorDragging && !_editorResizing) {
      _editorCanvas.style.cursor = 'default';
    }
  };
  _editorCanvas.onmouseup = () => { _editorDragging = false; _editorResizing = false; if (_editorSelected) { editorRenderProps(); editorAutoSave(); } };
  document.onmouseup = () => { _editorDragging = false; _editorResizing = false; };
  _editorCanvas.ondblclick = editorOnDblClick;

  // Touch
  _editorCanvas.ontouchstart = e => { const t=e.touches[0]; editorOnDown({clientX:t.clientX,clientY:t.clientY}); };
  _editorCanvas.ontouchmove = e => { const t=e.touches[0]; editorOnMove({clientX:t.clientX,clientY:t.clientY}); };
  _editorCanvas.ontouchend = () => { _editorDragging=false; _editorResizing=false; };
}

function editorGetPos(e) {
  const r = _editorCanvas.getBoundingClientRect();
  const sx = _editorCanvas.width / r.width;
  const sy = _editorCanvas.height / r.height;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

function editorHit(el, x, y) {
  if (el.type === 'text') {
    _editorCtx.font = (el.bold?'bold ':'')+el.fontSize+'px '+(el.fontFamily||'Arial');
    const tw = _editorCtx.measureText(el.text).width;
    return x>=el.x && x<=el.x+tw && y>=el.y-el.fontSize && y<=el.y;
  }
  if (el.type === 'circle') { const dx=x-el.x,dy=y-el.y; return Math.sqrt(dx*dx+dy*dy)<=el.rx; }
  if (el.type === 'line') {
    const len=Math.sqrt((el.x2-el.x)**2+(el.y2-el.y)**2);
    if(!len)return false;
    const t=Math.max(0,Math.min(1,((x-el.x)*(el.x2-el.x)+(y-el.y)*(el.y2-el.y))/(len*len)));
    return Math.sqrt((x-el.x-t*(el.x2-el.x))**2+(y-el.y-t*(el.y2-el.y))**2)<10;
  }
  return x>=el.x && x<=el.x+el.w && y>=el.y && y<=el.y+el.h;
}

function editorGetHandlePos(el) {
  // Returns bottom-right handle position for resize
  const bx = el.x;
  const by = el.type === 'text' ? el.y - (el.fontSize || 24) : el.y;
  const bw = el.w || (el.type === 'circle' ? el.rx * 2 : el.type === 'text' ? 100 : 80);
  const bh = el.h || (el.type === 'text' ? (el.fontSize || 24) : el.type === 'circle' ? el.rx * 2 : 40);
  return { x: bx + bw, y: by + bh };
}

function editorOnDown(e) {
  const p = editorGetPos(e);
  const fmt = editorGetActive();
  const elems = fmt.elements;

  // Check resize handle on selected element first
  if (_editorSelected) {
    const h = editorGetHandlePos(_editorSelected);
    const dist = Math.sqrt((p.x - h.x) ** 2 + (p.y - h.y) ** 2);
    if (dist < 12) {
      _editorResizing = true;
      _editorDragStart = { x: p.x, y: p.y, origW: _editorSelected.w || _editorSelected.rx * 2 || 80, origH: _editorSelected.h || _editorSelected.rx * 2 || 40, origSize: _editorSelected.fontSize || 24 };
      return;
    }
  }

  for (let i = elems.length - 1; i >= 0; i--) {
    if (editorHit(elems[i], p.x, p.y)) {
      _editorSelected = elems[i];
      _editorDragging = true;
      _editorResizing = false;
      _editorDragStart = { x: p.x - elems[i].x, y: p.y - elems[i].y };
      editorRenderLayers();
      editorRenderProps();
      editorRenderCanvas();
      return;
    }
  }
  _editorSelected = null;
  _editorResizing = false;
  editorRenderLayers();
  editorRenderProps();
  editorRenderCanvas();
}

function editorOnMove(e) {
  if (!_editorSelected) return;
  const p = editorGetPos(e);
  const fmt = editorGetActive();
  const el = _editorSelected;

  if (_editorResizing) {
    const dx = p.x - _editorDragStart.x;
    const dy = p.y - _editorDragStart.y;
    if (el.type === 'text') {
      el.fontSize = Math.max(8, Math.round(_editorDragStart.origSize + dy * 0.5));
    } else if (el.type === 'circle') {
      el.rx = Math.max(10, Math.round((_editorDragStart.origW + dx) / 2));
    } else {
      el.w = Math.max(20, Math.round(_editorDragStart.origW + dx));
      el.h = Math.max(10, Math.round(_editorDragStart.origH + dy));
      // Sync textSize for badges proportionally
      if ((el.type === 'badge' || el.textSize) && el.w) {
        el.textSize = Math.round(el.w * 0.048);
      }
    }
    editorRenderCanvas();
    return;
  }

  if (_editorDragging) {
    el.x = p.x - _editorDragStart.x;
    el.y = p.y - _editorDragStart.y;
    el.x = Math.max(-(el.w || 0) * 0.3, Math.min(fmt.w - (el.w || 0) * 0.2, el.x));
    el.y = Math.max(0, Math.min(fmt.h, el.y));
    editorRenderCanvas();
  }
}

function editorOnDblClick(e) {
  const p = editorGetPos(e);
  const fmt = editorGetActive();
  for (let i=fmt.elements.length-1; i>=0; i--) {
    if (editorHit(fmt.elements[i], p.x, p.y)) {
      const el = fmt.elements[i];
      const newText = prompt('Edit text:', el.text);
      if (newText !== null) { el.text = newText; editorRenderCanvas(); editorRenderLayers(); }
      return;
    }
  }
}

function editorRenderCanvas() {
  if (!_editorCanvas) return;
  const fmt = editorGetActive();
  const ctx = _editorCtx;
  const W = fmt.w, H = fmt.h;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,W,H);

  // Background poster image
  const bg = _editorBgImages[_editorActive];
  if (bg) {
    const s = Math.max(W/bg.width, H/bg.height);
    ctx.drawImage(bg, (W-bg.width*s)/2, (H-bg.height*s)/2, bg.width*s, bg.height*s);
  }

  // Draw elements
  for (const el of fmt.elements) {
    ctx.globalAlpha = el.opacity ?? 1;
    editorDrawEl(ctx, el, W, H, el === _editorSelected);
  }
  ctx.globalAlpha = 1;
}

function editorDrawEl(ctx, el, W, H, isSelected) {
  if (el.type === 'badge') {
    // Pre-styled gold pill badge
    const bH = el.h || Math.round(H * 0.1);
    const bW = el.w || Math.round(W * 0.8);
    const r = el.radius || bH * 0.35;
    ctx.fillStyle = el.fill || '#C9A84C';
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    editorRoundRect(ctx, el.x, el.y, bW, bH, r); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const fs = el.textSize || Math.round(W * 0.048);
    ctx.font = 'bold ' + fs + 'px Arial';
    ctx.fillStyle = el.textColor || '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(el.text, el.x + bW/2, el.y + bH/2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    el.w = bW; el.h = bH; // sync for hit testing
  } else if (el.type === 'text') {
    ctx.font = (el.italic?'italic ':'')+( el.bold?'bold ':'')+el.fontSize+'px '+(el.fontFamily||'Arial');
    if (el.shadow) { ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=6; ctx.shadowOffsetY=2; }
    ctx.fillStyle = el.color || '#fff';
    ctx.fillText(el.text, el.x, el.y);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  } else if (el.type === 'rect') {
    ctx.fillStyle = el.fill || '#C9A84C';
    if (el.radius) { editorRoundRect(ctx, el.x, el.y, el.w, el.h, el.radius); ctx.fill(); }
    else ctx.fillRect(el.x, el.y, el.w, el.h);
    if (el.strokeWidth > 0) { ctx.strokeStyle = el.stroke; ctx.lineWidth = el.strokeWidth; ctx.strokeRect(el.x,el.y,el.w,el.h); }
    if (el.text) {
      ctx.font = 'bold ' + (el.textSize||16) + 'px Arial';
      ctx.fillStyle = el.textColor || '#111';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.text, el.x+el.w/2, el.y+el.h/2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  } else if (el.type === 'circle') {
    ctx.beginPath(); ctx.arc(el.x, el.y, el.rx, 0, Math.PI*2);
    ctx.fillStyle = el.fill || '#C9A84C'; ctx.fill();
    if (el.strokeWidth>0) { ctx.strokeStyle=el.stroke; ctx.lineWidth=el.strokeWidth; ctx.stroke(); }
  } else if (el.type === 'line') {
    ctx.beginPath(); ctx.moveTo(el.x,el.y); ctx.lineTo(el.x2,el.y2);
    ctx.strokeStyle = el.stroke || '#C9A84C'; ctx.lineWidth = el.strokeWidth || 2; ctx.stroke();
  }

  // Selection outline
  if (isSelected) {
    const bx = el.x, by = el.type==='text' ? el.y-el.fontSize : el.y;
    const bw = el.w || (el.type==='circle'?el.rx*2:80);
    const bh = el.h || (el.type==='text'?el.fontSize:el.type==='circle'?el.rx*2:40);
    ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 2;
    ctx.setLineDash([4,3]); ctx.strokeRect(bx-2, by-2, bw+4, bh+4); ctx.setLineDash([]);
    // Resize handle bottom-right
    ctx.fillStyle = '#c9a84c'; ctx.beginPath();
    ctx.arc(bx+bw, by+bh, 6, 0, Math.PI*2); ctx.fill();
  }
}

function editorRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function editorAdd(type) {
  const fmt = editorGetActive();
  const W = fmt.w, H = fmt.h;
  let el;
  if (type === 'badge') el = { id:_editorIdCounter++, type:'badge', text:'Starts @ ₹59/SFT', x:W*0.1, y:H*0.72, w:W*0.8, h:H*0.1, fill:'#C9A84C', textColor:'#111', textSize:Math.round(W*0.048), radius:H*0.04, label:'Price Badge' };
  else if (type === 'text') el = { id:_editorIdCounter++, type:'text', text:'Edit this text', x:W*0.08, y:H*0.4, fontSize:Math.round(W*0.06), fontFamily:'Arial', bold:true, italic:false, color:'#fff', shadow:true, label:'Text' };
  else if (type === 'rect') el = { id:_editorIdCounter++, type:'rect', x:W*0.1, y:H*0.3, w:W*0.5, h:H*0.12, fill:'rgba(0,0,0,0.6)', stroke:'', strokeWidth:0, radius:6, label:'Box' };
  else if (type === 'line') el = { id:_editorIdCounter++, type:'line', x:W*0.08, y:H*0.5, x2:W*0.92, y2:H*0.5, stroke:'#C9A84C', strokeWidth:3, label:'Line' };
  else if (type === 'circle') el = { id:_editorIdCounter++, type:'circle', x:W*0.5, y:H*0.5, rx:50, fill:'rgba(201,168,76,0.3)', stroke:'#C9A84C', strokeWidth:2, label:'Circle' };
  else if (type === 'emoji') {
    const emoji = prompt('Enter emoji:', '🏠'); if (!emoji) return;
    el = { id:_editorIdCounter++, type:'text', text:emoji, x:W*0.4, y:H*0.5, fontSize:Math.round(W*0.12), fontFamily:'Arial', bold:false, italic:false, color:'#fff', shadow:false, label:'Emoji' };
  }
  if (el) { fmt.elements.push(el); _editorSelected = el; editorRenderCanvas(); editorRenderLayers(); editorRenderProps(); editorAutoSave(); }
}

function editorDelete(id) {
  const fmt = editorGetActive();
  fmt.elements = fmt.elements.filter(e => e.id !== id);
  if (_editorSelected?.id === id) _editorSelected = null;
  editorRenderCanvas(); editorRenderLayers(); editorRenderProps(); editorAutoSave();
}

function editorAutoSave() {
  if (!_editorCalendarId) return;
  const editorElements = {};
  Object.keys(_editorFormats).forEach(k => { editorElements[k] = _editorFormats[k].elements; });
  const newPI = { ..._editorPI, editor_elements: editorElements };
  sb.from('content_calendar').update({ platform_images: newPI, updated_at: new Date().toISOString() })
    .eq('id', _editorCalendarId).then(() => { _editorPI = newPI; }, () => {});
}

function editorRenderLayers() {
  const fmt = editorGetActive();
  const div = document.getElementById('editor-layers');
  if (!div) return;
  if (!fmt.elements.length) { div.innerHTML = '<div style="font-size:11px;color:#475569;text-align:center;padding:12px">No elements — add some from above</div>'; return; }
  div.innerHTML = [...fmt.elements].reverse().map(el => `
    <div onclick="window.editorSelectEl(${el.id})"
      style="background:#0f172a;border:1px solid ${_editorSelected?.id===el.id?'#c9a84c':'#334155'};border-radius:6px;padding:8px;margin-bottom:5px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:11px;font-weight:700;color:#f1f5f9">${el.label||el.type}</div>
        <div style="font-size:10px;color:#475569">${(el.text||'').slice(0,28)}</div>
      </div>
      <button onclick="event.stopPropagation();editorDelete(${el.id})"
        style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;padding:0 4px">✕</button>
    </div>`).join('');
}

function editorSelectEl(id) {
  const fmt = editorGetActive();
  _editorSelected = fmt.elements.find(e => e.id === id) || null;
  editorRenderCanvas(); editorRenderLayers(); editorRenderProps();
}

function editorRenderProps() {
  const div = document.getElementById('editor-props');
  if (!div) return;
  if (!_editorSelected) { div.style.display='none'; return; }
  div.style.display = 'block';
  const el = _editorSelected;

  const row = (label, html) => `<div style="margin-bottom:10px"><div style="font-size:9px;color:#64748b;font-weight:700;margin-bottom:4px">${label}</div>${html}</div>`;
  const col = (prop, val) => `<input type="color" value="${val}" onchange="window.editorUpdateProp(${el.id},'${prop}',this.value)" style="width:100%;height:30px;border:1px solid #334155;border-radius:4px;cursor:pointer;background:none">`;
  const txt = (prop, val) => `<input type="text" value="${val}" onchange="window.editorUpdateProp(${el.id},'${prop}',this.value)" style="width:100%;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:5px 8px;border-radius:5px;font-size:12px;box-sizing:border-box">`;
  // Slider with number — key for size controls
  const slide = (prop, val, min, max, step=1) => `
    <div style="display:flex;align-items:center;gap:6px">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}"
        oninput="window.editorUpdateProp(${el.id},'${prop}',+this.value);this.nextElementSibling.value=this.value"
        style="flex:1;accent-color:#c9a84c">
      <input type="number" min="${min}" max="${max}" step="${step}" value="${val}"
        onchange="window.editorUpdateProp(${el.id},'${prop}',+this.value);this.previousElementSibling.value=this.value"
        style="width:52px;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:3px 5px;border-radius:4px;font-size:11px">
    </div>`;
  const chk = (prop, val, label) => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" ${val?'checked':''} onchange="window.editorUpdateProp(${el.id},'${prop}',this.checked)"><span style="font-size:11px;color:#94a3b8">${label}</span></label>`;

  let html = `<div style="font-size:11px;font-weight:700;color:#c9a84c;margin-bottom:10px">✏️ ${el.label||el.type}</div>`;

  if (el.type === 'badge') {
    html += row('TEXT', txt('text', el.text));
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
      ${row('BG COLOR', col('fill', el.fill||'#C9A84C'))}
      ${row('TEXT COLOR', col('textColor', el.textColor||'#111'))}
    </div>`;
    html += row('FONT SIZE', slide('textSize', el.textSize||20, 8, 80));
    html += row('WIDTH', slide('w', Math.round(el.w||200), 40, 600));
    html += row('HEIGHT', slide('h', Math.round(el.h||50), 20, 200));
    html += row('CORNER RADIUS', slide('radius', Math.round(el.radius||0), 0, 100));
  } else if (el.type === 'text') {
    html += row('TEXT', txt('text', el.text));
    html += row('COLOR', col('color', el.color||'#fff'));
    html += row('FONT SIZE', slide('fontSize', el.fontSize||24, 8, 120));
    html += `<div style="display:flex;gap:12px;margin-bottom:10px">${chk('bold',el.bold,'Bold')}${chk('italic',el.italic,'Italic')}${chk('shadow',el.shadow,'Shadow')}</div>`;
  } else if (el.type === 'rect') {
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
      ${row('FILL', col('fill', el.fill||'#333'))}
      ${row('BORDER', col('stroke', el.stroke||'#fff'))}
    </div>`;
    html += row('BORDER WIDTH', slide('strokeWidth', el.strokeWidth||0, 0, 20));
    html += row('WIDTH', slide('w', Math.round(el.w||100), 20, 600));
    html += row('HEIGHT', slide('h', Math.round(el.h||50), 10, 400));
    html += row('CORNER RADIUS', slide('radius', Math.round(el.radius||0), 0, 100));
    if (el.text !== undefined) {
      html += row('TEXT', txt('text', el.text||''));
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${row('TEXT COLOR', col('textColor', el.textColor||'#fff'))}
      </div>`;
      html += row('TEXT SIZE', slide('textSize', el.textSize||16, 8, 80));
    }
  } else if (el.type === 'circle') {
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
      ${row('FILL', col('fill', el.fill||'#C9A84C'))}
      ${row('BORDER', col('stroke', el.stroke||'#fff'))}
    </div>`;
    html += row('BORDER WIDTH', slide('strokeWidth', el.strokeWidth||0, 0, 20));
    html += row('RADIUS', slide('rx', Math.round(el.rx||50), 10, 300));
  } else if (el.type === 'line') {
    html += row('COLOR', col('stroke', el.stroke||'#C9A84C'));
    html += row('THICKNESS', slide('strokeWidth', el.strokeWidth||2, 1, 30));
  }

  html += row('OPACITY', slide('opacity', Math.round((el.opacity??1)*100), 0, 100) + '<span id="opacity-disp" style="font-size:9px;color:#64748b"></span>');

  div.innerHTML = html;
}

function editorUpdateProp(id, prop, val) {
  const fmt = editorGetActive();
  const el = fmt.elements.find(e => e.id === id);
  if (!el) return;
  if (['fontSize','textSize','w','h','rx','strokeWidth','radius'].includes(prop)) val = +val;
  if (prop === 'opacity') val = +val / 100; // slider sends 0-100, store as 0-1
  if (prop === 'bold' || prop === 'italic' || prop === 'shadow') val = !!val;
  el[prop] = val;
  editorRenderCanvas();
}
window.editorUpdateProp = editorUpdateProp;

function editorSwitchFormat(key) {
  // Auto-save current format elements to DB before switching
  const editorElements = {};
  Object.keys(_editorFormats).forEach(k => { editorElements[k] = _editorFormats[k].elements; });
  if (_editorCalendarId) {
    const newPI = { ..._editorPI, editor_elements: editorElements };
    sb.from('content_calendar').update({ platform_images: newPI, updated_at: new Date().toISOString() })
      .eq('id', _editorCalendarId).then(() => {}, () => {});
    _editorPI = newPI;
  }

  _editorActive = key;
  _editorSelected = null;

  // Update format tabs
  Object.keys(_editorFormats).forEach(k => {
    const btn = document.getElementById('ftab-' + k);
    if (btn) {
      btn.style.background = k===key ? '#1e293b' : 'transparent';
      btn.style.borderBottom = k===key ? '2px solid #c9a84c' : '2px solid transparent';
      btn.style.color = k===key ? '#c9a84c' : '#64748b';
    }
  });

  // Re-init canvas for new format dimensions
  editorInitCanvas();
  editorRenderCanvas();
  editorRenderLayers();
  document.getElementById('editor-props').style.display = 'none';
}
window.editorSwitchFormat = editorSwitchFormat;

window.editorAdd = editorAdd;
window.editorDelete = editorDelete;
window.editorSelectEl = editorSelectEl;

// Scale element from display resolution to target resolution for high-quality export
function editorHandleMusicFile(input) {
  const file = input?.files?.[0];
  const uploadRow = document.getElementById('editor-music-upload-row');
  const status = document.getElementById('editor-music-status');
  if (sel.value === '__upload__') {
    uploadRow.style.display = 'block';
    window._editorMusicURL = null;
  } else if (sel.value === 'none') {
    uploadRow.style.display = 'none';
    window._editorMusicURL = null;
    if (status) status.textContent = '';
  } else {
    uploadRow.style.display = 'none';
    window._editorMusicURL = sel.value;
    // Preview 5s
    if (status) status.textContent = '▶ Playing preview…';
    const a = new Audio(sel.value); a.volume=0.5;
    a.play().then(()=>setTimeout(()=>{a.pause();if(status)status.textContent='✅ '+sel.options[sel.selectedIndex].text;},5000)).catch(()=>{if(status)status.textContent='Track ready';});
  }
}
function editorMusicChanged(sel) {
  const uploadRow = document.getElementById('editor-music-upload-row');
  const status = document.getElementById('editor-music-status');
  if (!sel) return;
  if (sel.value === '__upload__') {
    if (uploadRow) uploadRow.style.display = 'block';
    window._editorMusicURL = null;
  } else if (sel.value === 'none') {
    if (uploadRow) uploadRow.style.display = 'none';
    window._editorMusicURL = null;
    if (status) status.textContent = '';
  } else {
    if (uploadRow) uploadRow.style.display = 'none';
    window._editorMusicURL = sel.value;
    if (status) status.textContent = '▶ Playing preview…';
    const a = new Audio(sel.value);
    a.volume = 0.5;
    a.play()
      .then(() => setTimeout(() => {
        a.pause();
        if (status) status.textContent = '✅ ' + sel.options[sel.selectedIndex].text + ' — ready';
      }, 5000))
      .catch(() => { if (status) status.textContent = '✅ Track selected'; });
  }
}
window.editorMusicChanged = editorMusicChanged;


function editorHandleMusicFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (window._editorMusicObjectURL) URL.revokeObjectURL(window._editorMusicObjectURL);
  window._editorMusicObjectURL = URL.createObjectURL(file);
  window._editorMusicURL = window._editorMusicObjectURL;
  const status = document.getElementById('editor-music-status');
  if (status) status.textContent = '✅ ' + file.name.slice(0,30) + ' loaded';
  // Preview
  const preview = new Audio(window._editorMusicObjectURL);
  preview.volume = 0.5;
  preview.play().then(() => setTimeout(()=>preview.pause(), 5000)).catch(()=>{});
}
window.editorHandleMusicFile = editorHandleMusicFile;

function editorScaleEl(el, scale) {
  if (scale === 1) return el;
  const s = e => typeof e === 'number' ? Math.round(e * scale) : e;
  return { ...el,
    x: s(el.x), y: s(el.y),
    w: el.w ? s(el.w) : el.w,
    h: el.h ? s(el.h) : el.h,
    rx: el.rx ? s(el.rx) : el.rx,
    x2: el.x2 ? s(el.x2) : el.x2,
    y2: el.y2 ? s(el.y2) : el.y2,
    fontSize: el.fontSize ? s(el.fontSize) : el.fontSize,
    textSize: el.textSize ? s(el.textSize) : el.textSize,
    strokeWidth: el.strokeWidth ? Math.max(1, s(el.strokeWidth)) : el.strokeWidth,
    radius: el.radius ? s(el.radius) : el.radius,
  };
}

async function editorEncode() {
  // Save all formats' elements to platform_images
  const editorElements = {};
  let totalKb = 0;
  const newPI = { ..._editorPI };

  for (const key of Object.keys(_editorFormats)) {
    editorElements[key] = _editorFormats[key].elements;
  }
  newPI.editor_elements = editorElements;
  // Set offer_text from first badge element if any
  const firstBadge = Object.values(_editorFormats).flatMap(f=>f.elements).find(e=>e.type==='badge'||e.text);
  if (firstBadge) newPI.offer_text = firstBadge.text;

  // Close editor
  document.getElementById('badge-editor-popup').remove();

  const musicSelectVal = document.getElementById('editor-music')?.value;
  const musicURL = musicSelectVal === '__upload__' ? (window._editorMusicURL || null)
                 : musicSelectVal && musicSelectVal !== 'none' ? musicSelectVal
                 : null;
  const hasMusic = !!musicURL;

  let secs = 0;
  showMktToast('⏳ Encoding all formats… 0s', 5000);
  const ticker = setInterval(()=>{ secs+=3; showMktToast('⏳ Encoding… '+secs+'s', 5000); }, 3000);

  try {
    const libResp = await fetch('/assets/gifenc-worker.js');
    const libSrc = await libResp.text();
    const loadImgUrl = url => new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=url; });

    for (const key of Object.keys(_editorFormats)) {
      const fmt = _editorFormats[key];
      const srcUrl = _editorPI[fmt.imgKey]; if (!srcUrl) continue;
      showMktToast('⏳ Encoding '+fmt.label+'…', 5000);

      const bgImg = _editorBgImages[key] || await loadImgUrl(srcUrl).catch(()=>null);
      // PNG export at NATIVE resolution (1024×1024, 1024×1536, 1536×1024)
      // GIF encoded at display resolution (480px) for file size
      const NW = fmt.nativeW || fmt.w;
      const NH = fmt.nativeH || fmt.h;
      const W  = fmt.w, H = fmt.h; // display size for GIF
      const scale = NW / W; // scale factor from display → native
      const elements = fmt.elements;

      // Draw at NATIVE resolution for PNG
      const refCan = document.createElement('canvas'); refCan.width=NW; refCan.height=NH;
      const refCtx = refCan.getContext('2d');
      refCtx.fillStyle='#1a1a1a'; refCtx.fillRect(0,0,NW,NH);
      if (bgImg) {
        const s=Math.max(NW/bgImg.width,NH/bgImg.height);
        refCtx.drawImage(bgImg,(NW-bgImg.width*s)/2,(NH-bgImg.height*s)/2,bgImg.width*s,bgImg.height*s);
      }
      // Draw elements scaled to native res
      for (const el of elements) editorDrawEl(refCtx, editorScaleEl(el, scale), NW, NH, false);

      // Upload native PNG
      const pngBlob = await new Promise(res=>refCan.toBlob(res,'image/png'));
      const pngBytes=new Uint8Array(await pngBlob.arrayBuffer());
      const ts=Date.now();
      const {error:pe}=await sb.storage.from('calendar-images').upload('calendar/'+_editorCalendarId+'_ed_'+key+'_'+ts+'.png',pngBytes,{contentType:'image/png',upsert:true});
      if(!pe){
        const{data:pp}=sb.storage.from('calendar-images').getPublicUrl('calendar/'+_editorCalendarId+'_ed_'+key+'_'+ts+'.png');
        if(key==='square'){newPI['instagram_feed']=pp.publicUrl;newPI['threads']=pp.publicUrl;}
        if(key==='story'){newPI['instagram_story']=pp.publicUrl;newPI['facebook_story']=pp.publicUrl;newPI['whatsapp_story']=pp.publicUrl;}
        if(key==='landscape'){newPI['facebook_post']=pp.publicUrl;newPI['youtube']=pp.publicUrl;newPI['gbp']=pp.publicUrl;}
      }

      // Encode GIF at display resolution (480px — good quality, manageable size)
      const DELAY=80, FADE=8, HOLD=36, TOTAL=HOLD+FADE*2;
      const can=document.createElement('canvas');can.width=W;can.height=H;
      const ctx=can.getContext('2d');
      const frames=[];

      for(let f=0;f<TOTAL;f++){
        const t=f/(TOTAL-1);
        const fadeAlpha=f<FADE?f/FADE:f>TOTAL-FADE?(TOTAL-f)/FADE:1;
        const textT=f<FADE?0:Math.min(1,(f-FADE)/(HOLD*0.6));

        ctx.clearRect(0,0,W,H);
        ctx.fillStyle='#1a1a1a';ctx.fillRect(0,0,W,H);
        // Background
        if(bgImg){const s=Math.max(W/bgImg.width,H/bgImg.height);const zoom=1+0.04*t;ctx.drawImage(bgImg,(W-bgImg.width*s*zoom)/2,(H-bgImg.height*s*zoom)/2,bgImg.width*s*zoom,bgImg.height*s*zoom);}
        // Elements with stagger animation
        for(let ei=0;ei<elements.length;ei++){
          const el=elements[ei];
          const elDelay=ei*0.18;
          const elT=Math.max(0,Math.min(1,(textT-elDelay)/0.55));
          if(elT<=0)continue;
          const bounce=elT<0.6?elT/0.6:1+0.08*Math.sin((elT-0.6)/0.4*Math.PI);
          ctx.save();
          const cx=el.x+(el.w||0)/2, cy=el.y+(el.h||0)/2;
          ctx.translate(cx,cy+(1-bounce)*H*0.06);
          ctx.scale(bounce<1?bounce:1,bounce<1?bounce:1);
          ctx.translate(-cx,-cy);
          editorDrawEl(ctx,el,W,H,false);
          ctx.restore();
        }
        if(fadeAlpha<1){ctx.fillStyle='rgba(0,0,0,'+(1-fadeAlpha)+')';ctx.fillRect(0,0,W,H);}
        frames.push({data:Array.from(ctx.getImageData(0,0,W,H).data),delay:DELAY});
      }

      const wfn='self.onmessage=function(e){var f=e.data.frames,w=e.data.width,h=e.data.height,g=GIFEncoder();f.forEach(function(fr,i){var d=new Uint8ClampedArray(fr.data),p=quantize(d,256),ix=applyPalette(d,p);g.writeFrame(ix,w,h,{palette:p,delay:fr.delay,dispose:2});if(i%5===0)self.postMessage({type:"progress",pct:Math.round(i/f.length*100)});});g.finish();var b=g.bytes();self.postMessage({type:"done",buffer:b.buffer},[b.buffer]);};';
      const lUrl=URL.createObjectURL(new Blob([libSrc],{type:'application/javascript'}));
      const wUrl=URL.createObjectURL(new Blob(['importScripts("'+lUrl+'");\n'+wfn],{type:'application/javascript'}));
      const gifBlob=await new Promise((resolve,reject)=>{
        const worker=new Worker(wUrl);
        worker.onmessage=e=>{if(e.data.type==='progress')showMktToast('⏳ GIF '+fmt.label+' '+e.data.pct+'%',3000);else if(e.data.type==='done'){worker.terminate();URL.revokeObjectURL(wUrl);URL.revokeObjectURL(lUrl);resolve(new Blob([e.data.buffer],{type:'image/gif'}));}};
        worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};
        worker.postMessage({frames,width:W,height:H});
      });
      const gifBytes=new Uint8Array(await gifBlob.arrayBuffer());
      const gifPath='gif-calendar/'+_editorCalendarId+'_ed_'+key+'_'+ts+'.gif';
      const{error:ge}=await sb.storage.from('calendar-images').upload(gifPath,gifBytes,{contentType:'image/gif',upsert:true});
      if(!ge){
        const{data:gp}=sb.storage.from('calendar-images').getPublicUrl(gifPath);
        newPI[key+'_gif']=gp.publicUrl;
        if(key==='square'){newPI['gif']=gp.publicUrl;newPI['square_gif']=gp.publicUrl;}
        if(key==='story')newPI['story_gif']=gp.publicUrl;
        if(key==='landscape')newPI['landscape_gif']=gp.publicUrl;
        totalKb+=Math.round(gifBlob.size/1024);
      }

      // Also generate MP4 for this format (with music if selected, silent otherwise)
      // MP4 is used for Instagram, Facebook, auto-posting pipeline
      showMktToast('⏳ Encoding '+fmt.label+' MP4…', 5000);
      try {
        const drawFn = (ctx2, img2, W2, H2, els, t, textT) => {
          ctx2.clearRect(0,0,W2,H2);
          ctx2.fillStyle='#1a1a1a'; ctx2.fillRect(0,0,W2,H2);
          if(img2){const s=Math.max(W2/img2.width,H2/img2.height);const zoom=1+0.04*t;ctx2.drawImage(img2,(W2-img2.width*s*zoom)/2,(H2-img2.height*s*zoom)/2,img2.width*s*zoom,img2.height*s*zoom);}
          for(let ei=0;ei<els.length;ei++){
            const el=els[ei];const elDelay=ei*0.18;
            const elT=Math.max(0,Math.min(1,(textT-elDelay)/0.55));if(elT<=0)continue;
            const bounce=elT<0.6?elT/0.6:1+0.08*Math.sin((elT-0.6)/0.4*Math.PI);
            ctx2.save();const cx=el.x+(el.w||0)/2,cy=el.y+(el.h||0)/2;
            ctx2.translate(cx,cy+(1-bounce)*H2*0.06);ctx2.scale(bounce<1?bounce:1,bounce<1?bounce:1);ctx2.translate(-cx,-cy);
            editorDrawEl(ctx2,el,W2,H2,false);ctx2.restore();
          }
        };
        const mp4Blob = await mktExportMP4WithMusic(srcUrl, elements, 'cinematic', musicURL, W, H, drawFn);
        if(mp4Blob){
          const mp4Bytes=new Uint8Array(await mp4Blob.arrayBuffer());
          const ext=mp4Blob.type.includes('mp4')?'mp4':'webm';
          const mp4Path='gif-calendar/'+_editorCalendarId+'_ed_'+key+'_'+ts+'.'+ext;
          const{error:me}=await sb.storage.from('calendar-images').upload(mp4Path,mp4Bytes,{contentType:mp4Blob.type,upsert:true});
          if(!me){
            const{data:mp}=sb.storage.from('calendar-images').getPublicUrl(mp4Path);
            newPI[key+'_mp4']=mp.publicUrl;
            // Platform routing: MP4 for Instagram/Facebook/YouTube, GIF for WhatsApp
            if(key==='square'){
              newPI['instagram_feed_mp4']=mp.publicUrl;  // Instagram: use MP4
              newPI['threads_mp4']=mp.publicUrl;
              newPI['mp4_music']=mp.publicUrl;           // primary MP4
            }
            if(key==='story'){
              newPI['instagram_story_mp4']=mp.publicUrl;
              newPI['facebook_story_mp4']=mp.publicUrl;
              // WhatsApp story keeps GIF (already set above)
            }
            if(key==='landscape'){
              newPI['facebook_post_mp4']=mp.publicUrl;  // Facebook: use MP4
              newPI['youtube_mp4']=mp.publicUrl;
              newPI['gbp_mp4']=mp.publicUrl;
            }
            totalKb+=Math.round(mp4Blob.size/1024);
          }
        }
      } catch(mp4Err){ console.warn('MP4 encode failed for', key, mp4Err); }
    }

    await sb.from('content_calendar').update({
      image_url:newPI['gif']||newPI['instagram_feed'],
      platform_images:newPI, updated_at:new Date().toISOString()
    }).eq('id',_editorCalendarId);

    clearInterval(ticker);
    showMktNotif('✅ All 3 formats encoded & saved ('+totalKb+' KB total)');
    saveToHistory(_editorCalendarId,'gif_animated',{image_url:newPI['gif'],platform_images:newPI,prompt_summary:'Poster editor — '+Object.keys(_editorFormats).join(', ')});
    renderCalendar();
  } catch(e) {
    clearInterval(ticker);
    showMktNotif('❌ Encode failed: '+e.message);
  }
}
window.editorEncode = editorEncode;

function editorDownloadPNG() {
  const fmt = editorGetActive();
  const NW = fmt.nativeW || fmt.w;
  const NH = fmt.nativeH || fmt.h;
  const W  = fmt.w, H = fmt.h;
  const scale = NW / W;

  // Render at native resolution
  const nativeCan = document.createElement('canvas');
  nativeCan.width = NW; nativeCan.height = NH;
  const nCtx = nativeCan.getContext('2d');
  nCtx.fillStyle = '#1a1a1a'; nCtx.fillRect(0,0,NW,NH);
  const bgImg = _editorBgImages[_editorActive];
  if (bgImg) {
    const s = Math.max(NW/bgImg.width, NH/bgImg.height);
    nCtx.drawImage(bgImg, (NW-bgImg.width*s)/2, (NH-bgImg.height*s)/2, bgImg.width*s, bgImg.height*s);
  }
  for (const el of fmt.elements) editorDrawEl(nCtx, editorScaleEl(el, scale), NW, NH, false);

  const link = document.createElement('a');
  link.download = 'vwholesale-' + _editorActive + '-' + NW + 'x' + NH + '.png';
  link.href = nativeCan.toDataURL('image/png');
  link.click();
}
window.editorDownloadPNG = editorDownloadPNG;

// Universal editor entry point — works for calendar, Poster Studio, GIF Studio
async function openPosterEditor(calendarId, overrideImages) {
  if (overrideImages) {
    _editorCalendarId = null;
    _editorPI = {
      instagram_feed:  overrideImages.square    || null,
      instagram_story: overrideImages.story     || null,
      facebook_post:   overrideImages.landscape || null,
      editor_elements: {}
    };
    for (const key of Object.keys(_editorFormats)) _editorFormats[key].elements = [];
    _editorIdCounter = 1; _editorSelected = null;

    // Load all images in parallel
    const loadImg = (url) => new Promise(res => {
      const img = new Image(); img.crossOrigin='anonymous';
      img.onload=()=>res(img); img.onerror=()=>res(null); img.src=url;
    });
    const keys = Object.entries(_editorFormats);
    const imgs = await Promise.all(keys.map(([,fmt]) => {
      const url = _editorPI[fmt.imgKey];
      return url ? loadImg(url) : Promise.resolve(null);
    }));
    keys.forEach(([k], i) => { if (imgs[i]) _editorBgImages[k] = imgs[i]; });
    buildEditorPopup();
  } else {
    await calPreviewDraggableBadge(calendarId);
  }
}
window.openPosterEditor = openPosterEditor;
window.calSaveBadgePosition = function(){};
window.calApplyOfferBadgeWithPos = function(){};
window.renderBadgeEditor = function(){}; // legacy no-op
window.editorSwitchFormat = editorSwitchFormat;
window.editorAddElement = editorAddElement;
window.editorRemoveElement = editorRemoveElement;
window.editorUpdateElement = editorUpdateElement;
window.editorSaveAndEncode = editorSaveAndEncode;
window.calSaveBadgePosition = function(){}; // legacy no-op
window.calApplyOfferBadgeWithPos = function(){}; // legacy no-op



async function mktExportMP4WithMusic(posterUrl, elementsOrOffer, animStyle, musicUrl, W, H, drawFrameFn) {
  const img = await new Promise((res,rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => res(i); i.onerror = rej; i.src = posterUrl;
  });

  const can = document.createElement('canvas'); can.width = W; can.height = H;
  const ctx = can.getContext('2d');
  const videoStream = can.captureStream(30);
  let combined;

  if (musicUrl) {
    try {
      const audioCtx = new AudioContext();
      const musicResp = await fetch(musicUrl);
      if (!musicResp.ok) throw new Error('Music fetch failed');
      const musicBuffer = await audioCtx.decodeAudioData(await musicResp.arrayBuffer());
      const audioDest = audioCtx.createMediaStreamDestination();
      const musicSource = audioCtx.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = true;
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.7, audioCtx.currentTime);
      musicSource.connect(gainNode);
      gainNode.connect(audioDest);
      musicSource.start();
      combined = new MediaStream([...videoStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()]);
    } catch(e) {
      console.warn('Music failed, making silent video:', e.message);
      combined = videoStream;
    }
  } else {
    combined = videoStream; // silent video
  }
  const mimeTypes = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
  const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m));
  if (!mimeType) { musicSource.stop(); await audioCtx.close(); throw new Error('MediaRecorder not supported'); }

  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const TOTAL_SEC = 8;
  const isCinematic = (animStyle || 'cinematic') === 'cinematic';
  // Support both old string offer and new elements array
  const elements = Array.isArray(elementsOrOffer)
    ? elementsOrOffer
    : [{ id:1, text:elementsOrOffer||'', color:'#111', bg:'#C9A84C', size:18, posX:50, posY:75, bold:true }];

  gainNode.gain.setValueAtTime(0.7, audioCtx.currentTime + TOTAL_SEC - 2);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + TOTAL_SEC);

  const startTime = performance.now();
  recorder.start(100);

  await new Promise(resolve => {
    function draw() {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= TOTAL_SEC) { recorder.stop(); resolve(); return; }
      const t = elapsed / TOTAL_SEC;
      const fadeAlpha = elapsed < 0.6 ? elapsed/0.6 : elapsed > TOTAL_SEC-0.6 ? (TOTAL_SEC-elapsed)/0.6 : 1;
      const textT = elapsed < 0.6 ? 0 : Math.min(1, (elapsed-0.6)/(TOTAL_SEC*0.5));

      if (drawFrameFn) {
        drawFrameFn(ctx, img, W, H, elements, t, textT, isCinematic);
      } else {
        // Fallback simple draw
        ctx.clearRect(0,0,W,H);
        const bs=Math.min(W/img.naturalWidth,H/img.naturalHeight);
        ctx.drawImage(img,(W-img.naturalWidth*bs)/2,(H-img.naturalHeight*bs)/2,img.naturalWidth*bs,img.naturalHeight*bs);
      }
      if (fadeAlpha < 1) { ctx.fillStyle='rgba(0,0,0,'+(1-fadeAlpha)+')'; ctx.fillRect(0,0,W,H); }
      requestAnimationFrame(draw);
    }
    draw();
  });

  musicSource.stop();
  await audioCtx.close();
  return new Blob(chunks, { type: mimeType });
}
window.mktExportMP4WithMusic = mktExportMP4WithMusic;



async function calOpenGifStudio(calendarId) {
  // Navigate to GIF Studio with calendar context pre-filled
  const { data: item } = await sb.from('content_calendar').select('topic,caption,notes,poster_message').eq('id', calendarId).single().then(r=>r,()=>({data:null}));
  mktNav('gif');
  // Slight delay for render, then prefill
  setTimeout(() => {
    const briefEl = document.getElementById('gs-brief');
    if (briefEl && item) {
      briefEl.value = [item.topic, item.notes, item.poster_message].filter(Boolean).join('\n');
      document.getElementById('gs-out-headline').value = item.topic || '';
      document.getElementById('gs-out-message').value = item.poster_message || '';
      document.getElementById('gs-storyboard-section').style.display = 'grid';
      showMktToast('✨ GIF Studio opened — brief pre-filled from calendar post');
    }
  }, 600);
}

async function calConvertToGif(calendarId) {
  if (!confirm('Convert this post to GIF mode?\n\nYour original static poster is preserved — this is non-destructive.\nYou can switch back to Image at any time.')) return;
  // Mark as GIF type but store original content_type in metadata
  const { data: item } = await sb.from('content_calendar').select('content_type,image_url').eq('id', calendarId).single().then(r=>r,()=>({data:null}));
  await sb.from('content_calendar').update({
    content_type: 'gif',
    // Preserve original poster URL — just changing the content_type flag
    // image_url stays (original poster) — GIF Studio will set gif_url separately when done
    updated_at: new Date().toISOString()
  }).eq('id', calendarId);
  showMktToast('✨ Post type changed to GIF — original poster preserved. Click Create GIF to open GIF Studio.');
  renderCalendar();
}

async function calApproveItem(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktToast('❌ Item not found'); return; }
  if (!item.image_url) { showMktToast('❌ Upload an image first'); return; }

  // Build final bilingual caption: English + Telugu + hashtags
  const parts = [item.caption, item.caption_te, (item.hashtags||[]).join(' ')].filter(Boolean);
  const finalCaption = parts.join('\n\n');

  await sb.from('content_calendar').update({
    status: 'approved',
    caption: finalCaption,          // lock combined caption for publishing
    approved_by: 'Himansu',
    approved_at: new Date().toISOString(),
    content_locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', calendarId);
  showMktToast(`✅ Approved! Will auto-post at ${item.post_time||'10:00'} IST on ${item.cal_date}`);
  renderCalendar();
}

async function calUnapproveItem(calendarId) {
  if (!confirm('Undo approval? Post will not be published until re-approved.')) return;
  await sb.from('content_calendar').update({ status:'ready', approved_at:null, content_locked_at:null, updated_at:new Date().toISOString() }).eq('id', calendarId);
  showMktToast('↩ Approval removed');
  renderCalendar();
}

// ── Calendar post preview ──
async function calPreviewPost(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktToast('❌ Item not found'); return; }

  const channels = item.platform || ['instagram_feed','facebook_post','threads'];
  const PENDING_CHANNELS = new Set([]); // all channels active for posting
  const chMap = {
    instagram_feed:  { icon:'📸', name:'Instagram Feed' },
    instagram_story: { icon:'📸', name:'Instagram Story' },
    facebook_post:   { icon:'👤', name:'Facebook Post' },
    facebook_story:  { icon:'👤', name:'Facebook Story' },
    threads:         { icon:'🧵', name:'Threads' },
    youtube:         { icon:'▶️', name:'YouTube' },
    youtube_shorts:  { icon:'📱', name:'YouTube Shorts' },
    gbp:             { icon:'📍', name:'Google Business' },
    whatsapp_story:  { icon:'💬', name:'WhatsApp Status' },
  };
  const postDate = new Date(item.cal_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});

  const ov = document.createElement('div');
  ov.id = 'cal-preview-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);z-index:99999;overflow-y:auto;padding:20px';

  const caption = item.caption || '';
  const hashtags = (item.hashtags||[]).join(' ');
  const teCaption = item.caption_te || '';
  // Full bilingual caption: English + Telugu + hashtags — all in one
  const fullCaption = [caption, teCaption, hashtags].filter(Boolean).join('\n\n');

  // Image dimensions per platform
  const imgStyle = {
    instagram_feed:  'width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    instagram_story: 'width:60%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    facebook_post:   'width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    facebook_story:  'width:60%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    threads:         'width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    youtube:         'width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    youtube_shorts:  'width:60%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    gbp:             'width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    whatsapp_story:  'width:60%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
  };

  const channelPreviews = channels.map(ch => {
    const c = chMap[ch] || { icon:'📱', name:ch };
    // Adapt caption per channel with correct platform limits + bilingual
    let adapted = fullCaption; // default: English + Telugu + hashtags
    if (ch === 'instagram_feed') {
      // Instagram: full bilingual + hashtags, max 2200 chars
      adapted = fullCaption.slice(0, 2200);
    } else if (ch === 'threads') {
      // Threads max 500 chars — cut at sentence boundary
      const threadsText = caption + (hashtags ? '\n\n' + hashtags : '');
      if (threadsText.length <= 500) {
        adapted = threadsText;
      } else {
        // Find last sentence end before 480 chars
        const chunk = threadsText.slice(0, 480);
        const lastPeriod = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('! '), chunk.lastIndexOf('? '));
        adapted = lastPeriod > 100 ? chunk.slice(0, lastPeriod + 1) : chunk + '…';
      }
    } else if (ch === 'facebook_post') {
      // Facebook: bilingual caption, no hard limit but keep reasonable
      adapted = fullCaption.slice(0, 2000);
    } else if (ch === 'instagram_story' || ch === 'facebook_story') {
      // Stories: punchy 2-line hook. Take first sentence only, clean cutoff
      const firstSentence = caption.split(/[.!?]/)[0].trim();
      const hook = firstSentence.length > 20 ? firstSentence + '.' : caption.split('\n')[0];
      adapted = hook.slice(0, 200) + '\n\n👉 Visit V Wholesale\n📞 +91 8712697930';
    } else if (ch === 'whatsapp_story') {
      // WhatsApp Status: bilingual short version
      const firstLine = caption.split('\n')[0].slice(0, 300);
      adapted = firstLine + (teCaption ? '\n\n' + teCaption.split('\n')[0].slice(0, 200) : '');
    } else if (ch === 'gbp') {
      // GBP: no hashtags, max 1500 chars, local SEO focus, cut at sentence boundary
      const gbpText = caption.replace(/#[\w\u0C00-\u0C7F]+/g, '').trim();
      if (gbpText.length <= 1500) {
        adapted = gbpText;
      } else {
        const chunk = gbpText.slice(0, 1480);
        const lastPeriod = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('! '));
        adapted = lastPeriod > 200 ? chunk.slice(0, lastPeriod + 1) : chunk + '…';
      }
    } else if (ch === 'youtube') {
      adapted = fullCaption + '\n\n📍 Visit V Wholesale | +91 8712697930 | vwholesale.in';
    } else if (ch === 'youtube_shorts') {
      // YouTube Shorts: punchy hook + hashtags
      const firstSentence = caption.split(/[.!?]/)[0].trim();
      adapted = firstSentence + '.\n\n' + hashtags + '\n\n📍 V Wholesale | vwholesale.in';
    }

    const isPending = PENDING_CHANNELS.has(ch);
    // For GIF posts: show all 3 slides if available
    const isGifPost = item.content_type === 'gif';
    const gifSlides = isGifPost ? (item.platform_images?.gif_slides_square||'').split('|').filter(Boolean) : [];
    const rawImg = (item.platform_images && item.platform_images[ch]) || item.image_url || null;
    const platformImg = rawImg ? (rawImg.includes('.svg') ? rawImg + '?t=' + Date.now() : rawImg) : null;
    const iStyle = imgStyle[ch] || imgStyle['instagram_feed'];
    const noImgH = (ch.includes('story') || ch === 'whatsapp_story') ? 'aspect-ratio:9/16;width:56%' : 'height:120px;width:100%';
    const isVideo = item.content_type === 'reel';
    const isGif   = item.content_type === 'gif';

    // Pick the right image for each channel
    const pi = item.platform_images || {};

    // Map each channel to the correct image/GIF
    // GIF keys in platform_images: square_gif, story_gif, landscape_gif
    const channelGifKey = {
      instagram_feed: 'square_gif', threads: 'square_gif',
      instagram_story: 'story_gif', facebook_story: 'story_gif', whatsapp_story: 'story_gif',
      facebook_post: 'landscape_gif', youtube: 'landscape_gif', gbp: 'landscape_gif', youtube_shorts: 'story_gif'
    };
    const channelStaticKey = {
      instagram_feed: 'instagram_feed', threads: 'threads',
      instagram_story: 'instagram_story', facebook_story: 'facebook_story', whatsapp_story: 'whatsapp_story',
      facebook_post: 'facebook_post', youtube: 'youtube', gbp: 'gbp', youtube_shorts: 'instagram_story'
    };

    const gifForChannel = isGif ? (pi[channelGifKey[ch]] || null) : null;
    const staticForChannel = pi[channelStaticKey[ch]] || pi['instagram_feed'] || item.image_url || null;
    const displayImg = gifForChannel || staticForChannel;
    const isThisGif = !!gifForChannel;

    // Aspect ratio per channel
    const aspectMap = {
      instagram_feed: '1/1', threads: '1/1',
      instagram_story: '9/16', facebook_story: '9/16', youtube_shorts: '9/16', whatsapp_story: '9/16',
      facebook_post: '1.91/1', youtube: '16/9', gbp: '4/3'
    };
    const aspect = aspectMap[ch] || '1/1';
    const isStory = ch.includes('story') || ch === 'whatsapp_story' || ch === 'youtube_shorts';

    // Stories: centered phone-like width
    const chImgStyle = isStory
      ? 'width:55%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;margin:0 auto 8px auto;display:block'
      : 'width:100%;aspect-ratio:' + aspect + ';object-fit:cover;border-radius:8px;margin-bottom:8px;display:block';

    let mediaHtml = '';
    if (isGifPost) {
      const mp4Keys = { instagram_feed:'instagram_feed_mp4', threads:'threads_mp4', instagram_story:'instagram_story_mp4', facebook_story:'facebook_story_mp4', whatsapp_story:'whatsapp_story_mp4', facebook_post:'facebook_post_mp4', youtube:'youtube_mp4', gbp:'gbp_mp4' };
      const mp4Url = pi[mp4Keys[ch]] || null;
      const slideKey = (ch.includes('story')||ch==='whatsapp_story') ? 'gif_slides_story' : (ch==='facebook_post'||ch==='youtube'||ch==='gbp') ? 'gif_slides_landscape' : 'gif_slides_square';
      const slides = (pi[slideKey]||'').split('|').filter(Boolean);
      if (mp4Url) {
        const vidStyle = chImgStyle.replace('object-fit:cover','object-fit:contain');
        mediaHtml = '<video src="' + mp4Url + '" style="' + vidStyle + '" controls muted playsinline></video><div style="font-size:10px;color:var(--text3);text-align:center;margin-top:4px">🎬 MP4 ready</div>';
      } else if (slides.length > 0) {
        const cols = slides.length;
        let divs = '';
        for (let si = 0; si < slides.length; si++) {
          divs += '<div style="position:relative"><img src="' + slides[si] + '" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:5px"><span style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;font-size:8px;padding:1px 4px;border-radius:3px">Slide ' + (si+1) + '</span></div>';
        }
        mediaHtml = '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:3px;margin-bottom:6px">' + divs + '</div><div style="font-size:10px;color:var(--text3);text-align:center">↕ Slideshow MP4 rendering…</div>';
      } else {
        mediaHtml = '<div style="' + chImgStyle + ';background:var(--bg2);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px">✨ Generating…</div>';
      }
    } else if (!displayImg) {
      mediaHtml = '<div style="' + chImgStyle + ';background:var(--bg2);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px">' + (isVideo ? '🎬 No video yet' : '📸 No image yet') + '</div>';
    } else if (isVideo) {
      mediaHtml = '<video src="' + displayImg + '" style="' + chImgStyle.replace('object-fit:cover','object-fit:contain') + '" controls muted playsinline></video>';
    } else {
      mediaHtml = '<img src="' + displayImg + '" style="' + chImgStyle.replace('object-fit:cover','object-fit:contain') + ';background:#f5f0e8" onerror="this.style.display=\'none\'">';
    }

    const dlLabel = isThisGif ? '⬇ Download GIF' : '⬇ Download Image';
    const dlFilename = isThisGif ? 'vwholesale.gif' : 'vwholesale.png';
    const downloadLink = displayImg
      ? `<a href="javascript:void(0)" onclick="mktForceDownload('${displayImg}','${dlFilename}')" style="font-size:10px;color:var(--gold);text-decoration:none;cursor:pointer">${dlLabel}</a>`
      : '';

    return `
    <div style="background:var(--bg3);border-radius:10px;padding:14px;border:1px solid ${isPending?'rgba(245,158,11,.4)':'var(--border)'}">
      <div style="font-size:12px;font-weight:700;color:var(--text1);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
        <span>${c.icon} ${c.name}${isPending?'<span style="font-size:9px;background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:6px">⏳ PENDING</span>':''}</span>
        ${downloadLink}
      </div>
      ${mediaHtml}
      <div style="font-size:12px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${adapted.replace(/</g,'&lt;')}</div>
    </div>`;
  }).join('');

  ov.innerHTML = `
  <div style="max-width:520px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:16px;font-weight:900;color:var(--text1)">${cleanTopic(item.topic)}</div>
        <div style="font-size:11px;color:var(--text3)">${postDate} · ${item.post_time||'10:00'} IST · ${item.content_type||'image'}</div>
      </div>
      <button onclick="document.getElementById('cal-preview-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="padding:6px 12px">✕ Close</button>
    </div>

    ${item.reel_script ? `
    <div style="background:var(--bg3);border-radius:10px;padding:14px;border:1px solid var(--border);margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">🎬 Reel Script</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${item.reel_script.replace(/</g,'&lt;')}</div>
    </div>` : ''}

    <div style="display:grid;gap:12px;margin-bottom:16px">
      ${channelPreviews}
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('cal-preview-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="flex:1;padding:10px">Close</button>
      ${item.status === 'ready' && item.image_url
        ? `<button onclick="document.getElementById('cal-preview-overlay').remove();calApproveItem('${item.id}')" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;background:#22c55e;font-weight:700">✅ Approve & Schedule</button>`
        : ''}
    </div>
  </div>`;

  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

// Build sizes list for display in calendar row
function buildCalSizesList(platforms) {
  const sizes = {};
  for (const ch of (platforms||[])) {
    if (ch === 'instagram_feed' || ch === 'threads') sizes['1080\u00d71080 (1:1)'] = true;
    if (ch === 'instagram_story' || ch === 'facebook_story' || ch === 'whatsapp_story') sizes['1080\u00d71920 (9:16)'] = true;
    if (ch === 'facebook_post') sizes['1200\u00d7630 (1.91:1)'] = true;
    if (ch === 'youtube') sizes['1280\u00d7720 (16:9)'] = true;
    if (ch === 'gbp') sizes['1200\u00d7900 (4:3)'] = true;
  }
  const list = Object.keys(sizes);
  return list.length ? '📐 ' + list.join(' · ') : '';
}

// Direct regenerate — no edit form needed
async function calRegenerateItem(calendarId) {
  const btn = document.querySelector(`button[onclick="calRegenerateItem('${calendarId}')"]`);
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '⏳'; btn.disabled = true; }

  let secs = 0;
  const ticker = setInterval(() => { secs += 3; showMktToast('⏳ Generating… ' + secs + 's', 5000); }, 3000);

  try {
    // Load item to detect content type
    const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
    if (!item) throw new Error('Item not found');

    const isGif = item.content_type === 'gif';
    const isReel = item.content_type === 'reel';

    if (isGif) {
      // GIF: caption first, then Railway generates 9 images + MP4 automatically
      showMktToast('⏳ Step 1/2: Generating caption…', 5000);
      const captionRes = await fetch(MKT_SB_URL+'/functions/v1/content-pipeline', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({action:'generate_single', calendar_id: parseInt(calendarId)})
      });
      const captionData = await captionRes.json();
      if (!captionData.ok) throw new Error('Caption failed: ' + (captionData.error||''));

      showMktToast('⏳ Step 2/2: Sending to Railway for 9 images + MP4 (~5-8 min)…', 8000);

      // Reset gif_status so Railway processes fresh
      await sb.from('content_calendar').update({ gif_status: null, updated_at: new Date().toISOString() }).eq('id', calendarId);

      // Fire Railway — generates everything in background
      const RAIL_URL = 'https://vwholesale-render-worker-production.up.railway.app';
      const RAIL_SECRET = 'vw-render-2026-secret';
      const fireRes = await fetch(RAIL_URL + '/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-secret': RAIL_SECRET },
        body: JSON.stringify({ action: 'gif_slideshow', calendar_id: parseInt(calendarId) })
      });
      const fireData = await fireRes.json();
      if (!fireData.ok) throw new Error('Railway rejected: ' + (fireData.error||''));

      clearInterval(ticker);
      if (btn) { btn.innerHTML = origText; btn.disabled = false; }
      showMktNotif('✅ Caption done! Railway generating 9 images + MP4s in background (~5-8 min). Post will be ready soon.');

      // Poll progress in background
      const pollInterval = setInterval(async () => {
        try {
          const pr = await fetch(RAIL_URL + '/progress/' + calendarId);
          const pd = await pr.json();
          if (pd.status === 'ready') {
            clearInterval(pollInterval);
            showMktNotif('✅ GIF post ready! All 9 images + 3 MP4s generated. Click 🚀 Post Now.');
            renderCalendar();
          } else if (pd.progress?.step) {
            showMktToast('⏳ Railway: ' + pd.progress.step + ' (' + (pd.progress.done||0) + '/' + (pd.progress.total||9) + ')…', 11000);
          }
        } catch(e) {}
      }, 10000);
      setTimeout(() => clearInterval(pollInterval), 600000);
      renderCalendar();

    } else {
      // Image/Festival/Reel: standard generate_single
      showMktToast('⏳ Generating caption + poster…', 5000);
      const res = await fetch(MKT_SB_URL+'/functions/v1/content-pipeline', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({action:'generate_single', calendar_id: parseInt(calendarId)})
      });
      clearInterval(ticker);
      const data = await res.json();
      if (data.ok) {
        showMktToast('✅ Done! Approval email sent to hmehta@vwholesale.in', 6000);
        renderCalendar();
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    }

  } catch(e) {
    clearInterval(ticker);
    showMktToast('❌ ' + e.message, 6000);
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
  }
}

// ── ROYALTY-FREE MUSIC TRACKS ──

function mktMusicPickerHTML(selectedId = 'none') {
  const moodLabels = {silent:'🔇 No Music',upbeat:'⚡ Upbeat Corporate',cinematic:'🎬 Cinematic',energetic:'🔥 Energetic',ambient:'🏠 Ambient Home',festive:'🎉 Festive',custom:'📁 Custom Upload'};
  const moods = ['silent','upbeat','cinematic','energetic','ambient','festive','custom'];
  const grouped = moods.map(m=>({label:moodLabels[m]||m,options:MKT_MUSIC_TRACKS.filter(t=>t.mood===m)})).filter(g=>g.options.length);
  const optgroups = grouped.map(g=>'<optgroup label="'+g.label+'">'+g.options.map(t=>'<option value="'+t.id+'" '+(t.id===selectedId?'selected':'')+'>'+t.label+'</option>').join('')+'</optgroup>').join('');
  const sel = MKT_MUSIC_TRACKS.find(t=>t.id===selectedId);
  return '<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#94a3b8;display:block;margin-bottom:6px">🎵 MUSIC <span style="font-weight:400;color:#475569">(CC-BY · attribution auto-added to caption)</span></label>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<select id="mkt-music-select" name="mkt-music-select" onchange="mktMusicSelectChange(this)" style="flex:1;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:8px;border-radius:8px;font-size:12px">'+optgroups+'</select>'
    +'<button onclick="mktPreviewMusicFromSelect()" style="background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.4);color:#c9a84c;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:12px;white-space:nowrap">▶ Preview</button>'
    +'</div>'
    +'<div id="mkt-music-attribution" style="font-size:10px;color:#64748b;margin-top:4px">'+(sel?.attribution||'')+'</div>'
    +'<div id="mkt-music-status" style="font-size:10px;color:#22c55e;margin-top:2px"></div>'
    +'<div id="mkt-music-upload-wrap" style="display:none;margin-top:6px"><input type="file" id="music-upload-input" accept="audio/*" onchange="mktHandleMusicUpload(this)" style="font-size:11px;color:#64748b;width:100%"></div>'
    +'<input type="hidden" id="mkt-music-value" name="mkt-music" value="'+selectedId+'">'
    +'</div>';
}
function mktMusicSelectChange(sel) {
  const val = sel.value;
  document.getElementById('mkt-music-value').value = val;
  const wrap = document.getElementById('mkt-music-upload-wrap');
  if (wrap) wrap.style.display = val === 'upload' ? 'block' : 'none';
}
// Auto-select music based on content type
function autoSelectMusicId(contentType) {
  const defaults = {
    gif: 'upbeat_corporate',
    reel: 'energetic_power',
    festival: 'festive_celebration',
    image: 'ambient_home',
    poster: 'ambient_home'
  };
  const mood = defaults[contentType] || 'upbeat_corporate';
  const track = MKT_MUSIC_TRACKS.find(t => t.mood !== 'silent' && t.mood !== 'custom' && (t.id.startsWith(mood.split('_')[0]) || t.mood === mood.split('_')[0]));
  return track?.id || (MKT_MUSIC_TRACKS.find(t => t.mood !== 'silent' && t.mood !== 'custom')?.id) || 'none';
}

window.mktMusicSelectChange = mktMusicSelectChange;
function mktPreviewMusicFromSelect() {
  const sel = document.getElementById('mkt-music-select');
  if (!sel) return;
  mktPreviewMusic(sel.value);
}
window.mktPreviewMusicFromSelect = mktPreviewMusicFromSelect;


// _uploadedMusicURL declared at top of file

function mktHandleMusicUpload(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (_uploadedMusicURL) URL.revokeObjectURL(_uploadedMusicURL);
  _uploadedMusicURL = URL.createObjectURL(file);
  // Auto-select upload radio
  const hiddenInput = document.getElementById('mkt-music-value');
  if (hiddenInput) { hiddenInput.value = 'upload'; }
  const sel = document.getElementById('mkt-music-select');
  if (sel) { sel.value = 'upload'; mktMusicSelectChange(sel); }
  // Show status
  const status = document.getElementById('mkt-music-status');
  if (status) status.textContent = '✅ ' + file.name.slice(0,35) + ' (' + Math.round(file.size/1024) + ' KB) — playing preview…';
  // Auto-preview 5s
  const preview = new Audio(_uploadedMusicURL);
  preview.volume = 0.6;
  preview.play().then(()=>setTimeout(()=>{ preview.pause(); const s=document.getElementById('mkt-music-status'); if(s)s.textContent='✅ '+file.name.slice(0,35)+' ready'; }, 5000)).catch(e=>{
    const s=document.getElementById('mkt-music-status'); if(s)s.textContent='⚠️ Preview failed — file loaded for export';
  });
  showMktToast('✅ ' + file.name.slice(0,30) + ' loaded', 3000);
}
window.mktHandleMusicUpload = mktHandleMusicUpload;

function mktGetMusicURL(trackId) {
  if (trackId === 'upload') return _uploadedMusicURL;
  if (trackId === 'none') return null;
  const track = MKT_MUSIC_TRACKS.find(t => t.id === trackId);
  return (track?.url && track.url !== '__upload__') ? track.url : null;
}

function mktPreviewMusic(trackId) {
  if (_musicPreviewAudio) { _musicPreviewAudio.pause(); _musicPreviewAudio = null; }
  const url = mktGetMusicURL(trackId);
  if (!url) return;
  _musicPreviewAudio = new Audio(url);
  _musicPreviewAudio.volume = 0.6;
  _musicPreviewAudio.play().catch(e => showMktToast('❌ Preview failed: ' + e.message, 3000));
  setTimeout(() => { if (_musicPreviewAudio) { _musicPreviewAudio.pause(); _musicPreviewAudio = null; } }, 8000);
}
window.mktPreviewMusic = mktPreviewMusic;

// Wire up music radio button styling
function mktBindMusicPicker() {
  document.querySelectorAll('input[name="mkt-music"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('[id^="music-opt-"]').forEach(el => el.style.borderColor = '#334155');
      document.getElementById('music-opt-' + r.value)?.style.setProperty('border-color', '#c9a84c');
    });
  });
}

window.calRegenerateItem = calRegenerateItem;



async function calGeneratePosters(calendarId, reuseBg) {
  // Auto-detect quality mode: premium for festivals/special, standard for regular posts
  // The edge function also auto-detects from item.content_type, this is just for the toast
  const btn = document.querySelector(`button[onclick*="calGeneratePosters('${calendarId}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  showMktToast(reuseBg ? '🎨 Re-applying layout with stored backgrounds… (free)' : '⏳ Generating AI poster for all platforms… (~60-90s)');
  try {
    await fetch(MKT_SB_URL + '/rest/v1/content_calendar?id=eq.' + calendarId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY, 'Authorization': 'Bearer ' + MKT_SB_KEY },
      body: JSON.stringify({ image_url: null, platform_images: null, updated_at: new Date().toISOString() })
    });
    renderCalendar();
    const res = await fetch(MKT_SB_URL + '/functions/v1/generate-poster-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'generate_posters',
        calendar_id: parseInt(calendarId),
        logo_b64: VW_LOGO_B64,
        reuse_bg: !!reuseBg
        // quality_mode not sent — edge function auto-detects from content_type/is_festival
      })
    });
    const data = await res.json();
    if (data.ok) {
      // Save to history
      const { data: updItem } = await sb.from('content_calendar').select('image_url,platform_images,caption,caption_te,hashtags,poster_message').eq('id', calendarId).single();
      if (updItem?.image_url) saveToHistory(calendarId, 'poster', {
        image_url: updItem.image_url,
        platform_images: updItem.platform_images,
        caption_en: updItem.caption,
        caption_te: updItem.caption_te,
        hashtags: updItem.hashtags,
        poster_message: updItem.poster_message,
        prompt_summary: reuseBg ? 'Re-applied layout (free)' : (data.summary || 'AI Poster — all formats')
      });
      showMktToast(`✅ ${data.summary || 'Posters generated'} — click Preview to review`);
      renderCalendar();
    } else {
      showMktToast('⚠️ ' + (data.error || 'Poster generation failed'));
      renderCalendar();
    }
  } catch(e) {
    showMktToast('❌ ' + e.message);
    renderCalendar();
  }
}
window.calGeneratePosters = calGeneratePosters;


// ── BROWSER-SIDE PUBLISHER — posts directly from browser, no Supabase egress needed ──
async function calPostNow(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktNotif('No post found'); return; }

  // AUTO-GENERATE: If GIF post has no images, generate them first
  const pi0 = item.platform_images || {};
  const isGifType = item.content_type === 'gif';
  const hasImages = pi0.instagram_feed || pi0.image_url || item.image_url;
  const hasGif = pi0.square_gif || pi0.gif;

  if (!hasImages) {
    showMktNotif('⏳ Auto-generating posters first…');
    try {
      await calGeneratePosters(calendarId);
    } catch(e) { showMktNotif('❌ Auto-poster failed: ' + e.message); return; }
  }

  if (isGifType && !hasGif) {
    showMktNotif('⏳ Auto-generating GIF slideshow…');
    try {
      await calGenerateGif(calendarId, null, 'slideshow', 'none');
    } catch(e) { console.warn('Auto-GIF failed:', e); }
  }
  const { data: settings } = await sb.from('marketing_settings').select('key,value')
    .in('key', ['META_IG_ID','META_PAGE_ID','META_PAGE_ID_2','META_SYSTEM_USER_TOKEN','THREADS_ACCESS_TOKEN','THREADS_NUMERIC_ID','META_WA_PHONE_ID','META_WA_TOKEN','META_WA_OWNER_PHONE']);
  const cfg = {}; (settings||[]).forEach(s => cfg[s.key] = s.value);

  // Quick credential check
  if (!cfg['META_SYSTEM_USER_TOKEN']) {
    showMktNotif('❌ Cannot read credentials — check RLS. Keys loaded: ' + (settings?.length||0));
    return;
  }
  const channels = item.platform || ['instagram_feed','facebook_post','threads'];
  const pi = item.platform_images || {};
  const caption = [item.caption, item.caption_te, (item.hashtags||[]).join(' ')].filter(Boolean).join('\n\n');
  const META_API = 'https://graph.facebook.com/v25.0';
  const st = cfg['META_SYSTEM_USER_TOKEN'];

  const pop = document.createElement('div');
  pop.id = 'postnow-popup';
  pop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';

  const chLabels = {instagram_feed:'📸 Instagram Feed',instagram_story:'📱 IG Story',facebook_post:'📘 Facebook Post',facebook_story:'📱 FB Story',threads:'🧵 Threads',whatsapp_story:'💬 WhatsApp Broadcast',gbp:'📍 Google Business',youtube:'▶️ YouTube',youtube_shorts:'▶️ YouTube Shorts',youtube_community:'💬 YT Community Post'};
  const chMediaHint = {instagram_feed:'MP4/Image',instagram_story:'MP4/Image',facebook_post:'MP4/Image',facebook_story:'MP4/Image',threads:'GIF/Image',whatsapp_story:'GIF/Image',gbp:'Image',youtube:'MP4'};

  const isGifPost = item.content_type === 'gif';
  const gifKeyMap = {instagram_feed:'instagram_feed',instagram_story:'instagram_story',facebook_post:'facebook_post',facebook_story:'facebook_story',threads:'instagram_feed',whatsapp_story:'story_gif',youtube:'youtube',gbp:'gbp'};

  const gifMp4Map = {
    instagram_feed: 'instagram_feed_mp4', instagram_story: 'instagram_story_mp4',
    facebook_post: 'facebook_post_mp4', facebook_story: 'facebook_story_mp4',
    threads: 'threads_mp4', whatsapp_story: 'whatsapp_story_mp4',
    youtube: 'youtube_mp4', gbp: 'gbp_mp4'
  };
  const gifStaticMap = {
    instagram_feed: 'instagram_feed', instagram_story: 'instagram_story',
    facebook_post: 'facebook_post', facebook_story: 'facebook_story',
    threads: 'instagram_feed', whatsapp_story: 'instagram_story',
    youtube: 'youtube', gbp: 'facebook_post'
  };

  const rows = channels.map(ch => {
    const img = isGifPost
      ? (pi[gifMp4Map[ch]] || pi[gifStaticMap[ch]] || pi['square_gif'] || item.image_url)
      : (pi[ch+'_mp4'] || pi['mp4_music'] || pi[ch] || item.image_url);
    const mediaType = isGifPost
      ? (pi[gifMp4Map[ch]] ? '🎬 MP4 ready' : '🖼️ Image only')
      : (img&&img.includes('.mp4') ? 'MP4' : 'Image');
    const mediaOk = !!img;
    return '<div id="ch-row-'+ch+'" style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px">'
      +'<div style="font-size:18px">'+(chLabels[ch]||ch).split(' ')[0]+'</div>'
      +'<div style="flex:1">'
      +'<div style="font-size:12px;font-weight:700;color:#f1f5f9">'+(chLabels[ch]||ch)+'</div>'
      +'<div style="font-size:10px;color:'+(mediaOk?'#475569':'#ef4444')+'">'+(mediaOk?'✅ '+mediaType+' ready':'⚠️ No media — regenerate GIF')+'</div>'
      +'</div>'
      +'<div id="ch-status-'+ch+'" style="font-size:11px;color:#64748b">Waiting…</div>'
      +'</div>';
  }).join('');

  const WA_TEMPLATES = [
    {id:'image', label:'📸 Send Image/GIF directly (no template)', params:[]},
    {id:'vwholesale_offer_alert', label:'🔥 Offer Alert — Hi {name}! Special offer: {topic}. Valid till {date}', params:['name','topic','date']},
    {id:'vwholesale_new_arrival', label:'✨ New Arrival — Hi {name}! New {topic} arrivals at V Wholesale', params:['name','topic']},
    {id:'vwholesale_visit_invite', label:'🏪 Visit Invite — Hi {name}! 5000+ products, come visit us', params:['name']},
    {id:'vwholesale_contractor_invite', label:'🔧 Contractor Club — Hi {name}! Earn 2% on every referral', params:['name']},
    {id:'vwholesale_festival_greeting', label:'🎉 Festival Greeting — {festival} wishes to {name}', params:['festival','name']},
    {id:'vwholesale_feedback_request', label:'⭐ Feedback Request — Hi {name}, rate us on Google Maps', params:['name','product']},
    {id:'vwholesale_welcome', label:'👋 Welcome — Welcome {name} to V Wholesale!', params:['name']},
    {id:'vwholesale_quotation_ready', label:'📋 Quotation Ready — Hi {name}, quote #{no} ₹{amount} ready', params:['name','no','amount']},
    {id:'vwholesale_contractor_update', label:'📊 Contractor Update — Hi {name}, your earnings: ₹{amount}', params:['name','update','amount']},
  ];
  const hasWA = channels.includes('whatsapp_story');
  const waSection = hasWA
    ? '<div style="background:#0d2818;border:1px solid #166534;border-radius:8px;padding:12px;margin-bottom:12px">'
      +'<div style="font-size:11px;font-weight:700;color:#22c55e;margin-bottom:8px">💬 WhatsApp — How to send?</div>'
      // Template picker
      +'<div style="margin-bottom:10px">'
      +'<label style="font-size:10px;color:#94a3b8;display:block;margin-bottom:4px">TEMPLATE / MESSAGE TYPE</label>'
      +'<select id="wa-template-select" style="width:100%;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:8px;border-radius:6px;font-size:11px">'
      +WA_TEMPLATES.map(t=>'<option value="'+t.id+'">'+t.label+'</option>').join('')
      +'</select>'
      +'</div>'
      // Who to send to
      +'<div style="font-size:10px;color:#94a3b8;margin-bottom:5px">SEND TO</div>'
      +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#f1f5f9;margin-bottom:5px">'
      +'<input type="radio" name="wa-target" value="owner" checked style="accent-color:#22c55e"> My number (+91 90380 10175) — I will forward manually</label>'
      +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#f1f5f9;margin-bottom:5px">'
      +'<input type="radio" name="wa-target" value="select" style="accent-color:#22c55e"> Specific numbers</label>'
      +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#f1f5f9">'
      +'<input type="radio" name="wa-target" value="all" style="accent-color:#22c55e"> All opted-in customers (~₹0.78/msg for templates)</label>'
      +'<div id="wa-customer-select" style="display:none;margin-top:8px">'
      +'<input id="wa-phone-input" type="text" placeholder="9876543210, 9123456789, …" style="width:100%;background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:8px;border-radius:6px;font-size:12px;box-sizing:border-box">'
      +'<div style="font-size:10px;color:#64748b;margin-top:4px">Comma-separated 10-digit numbers.</div>'
      +'</div>'
      +'</div>'
    : '';

  const btnHtml = '<div style="display:flex;gap:8px">'
    +'<button id="postnow-start" onclick="calPostNowExecute(\''+calendarId+'\')" style="flex:1;background:#3b82f6;border:none;color:#fff;padding:12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">🚀 Post to All '+channels.length+' Platforms Now</button>'
    +'<button onclick="calPostNowDebug(\''+calendarId+'\')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:12px 14px;border-radius:8px;cursor:pointer;font-size:12px">🔍 Debug</button>'
    +'</div>';

  pop.innerHTML = '<div style="background:#1e293b;border-radius:14px;padding:24px;max-width:480px;width:100%;border:1px solid #334155;max-height:90vh;overflow-y:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    +'<div style="font-size:14px;font-weight:900;color:#f1f5f9">🚀 Post Now — '+cleanTopic(item.topic).slice(0,40)+'</div>'
    +'<button onclick="document.getElementById(\'postnow-popup\').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">✕</button>'
    +'</div>'
    +'<div style="font-size:11px;color:#64748b;margin-bottom:12px">Posts from your browser directly — no scheduling</div>'
    +waSection
    +'<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">'+rows+'</div>'
    +btnHtml
    +'</div>';

  pop.addEventListener('click', e => { if (e.target===pop) pop.remove(); });
  document.body.appendChild(pop);

  if (hasWA) {
    pop.querySelectorAll('input[name="wa-target"]').forEach(r => {
      r.addEventListener('change', () => {
        const sel = document.getElementById('wa-customer-select');
        if (sel) sel.style.display = r.value === 'select' ? 'block' : 'none';
      });
    });
  }

  // Get music attribution - from popup selection OR from stored platform_images
  const selectedMusicId = document.getElementById('mkt-music-value')?.value || 'none';
  const selectedTrack = MKT_MUSIC_TRACKS.find(t => t.id === selectedMusicId);
  const musicAttribution = (selectedMusicId !== 'none' && selectedTrack?.attribution)
    ? selectedTrack.attribution
    : (pi['music_attribution'] || null);  // fallback to stored attribution

  window._postNowCtx = { item, cfg, channels, pi, caption, META_API, st, musicAttribution };
}

async function calPostNowExecute(calendarId) {
  const btn = document.getElementById('postnow-start');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Posting…'; }
  const { item, cfg, channels, pi, caption, META_API, st, musicAttribution } = window._postNowCtx;
  const results = {};

  const setStatus = (ch, icon, msg, color='#94a3b8') => {
    const el = document.getElementById('ch-status-'+ch);
    if (el) { el.innerHTML = icon+' '+msg; el.style.color = color; }
    const row = document.getElementById('ch-row-'+ch);
    if (row) row.style.borderColor = color==='#22c55e'?'rgba(34,197,94,.5)':color==='#ef4444'?'rgba(239,68,68,.5)':'#334155';
  };

  for (const ch of channels) {
    setStatus(ch, '⏳', 'Posting…', '#f59e0b');
    const isGifPost = item.content_type === 'gif';
    // For GIF posts: use MP4 (H.264) for all channels — no more black posts
    const gifMp4KeyMap = {
      instagram_feed:  'instagram_feed_mp4',
      instagram_story: 'instagram_story_mp4',
      facebook_post:   'facebook_post_mp4',
      facebook_story:  'facebook_story_mp4',
      threads:         'threads_mp4',
      whatsapp_story:  'whatsapp_story_mp4',
      youtube:         'youtube_mp4',
      gbp:             'gbp_mp4'
    };
    const gifStaticFallback = {
      instagram_feed: 'instagram_feed', instagram_story: 'instagram_story',
      facebook_post: 'facebook_post', threads: 'instagram_feed',
      whatsapp_story: 'instagram_story', youtube: 'youtube', gbp: 'facebook_post'
    };
    const img = isGifPost
      ? (pi[gifMp4KeyMap[ch]] || pi[gifStaticFallback[ch]] || pi['instagram_feed'] || item.image_url)
      : (pi[ch+'_mp4'] || pi['mp4_music'] || pi[ch] || item.image_url);
    const isVideo = !!(img && (img.includes('.mp4') || img.includes('.webm')));
    // Note: for GIF posts on IG/FB, img will be .mp4 → isVideo=true → posts as Reel/Video
    // Auto-append music attribution if music was used (CC-BY licence requirement)
    const baseCaption = musicAttribution
      ? caption + '\n\n🎵 ' + musicAttribution
      : caption;
    const cap = baseCaption.slice(0, ch==='threads'?500:2200);
    let ok=false, postId='', error='';

    try {
      if (ch==='instagram_feed') {
        if (!cfg.META_IG_ID||!st) { error='META_IG_ID not set in settings'; }
        else {
          const payload = isVideo
            ? {video_url:img, caption:cap, media_type:'REELS'}
            : {image_url:img, caption:cap, media_type:'IMAGE'};
          const cr = await (await fetch(META_API+'/'+cfg.META_IG_ID+'/media',{method:'POST',
            headers:{'Authorization':'Bearer '+st,'Content-Type':'application/json'},
            body:JSON.stringify(payload)})).json();
          if (cr.id) {
            if (isVideo) {
              setStatus(ch,'⏳','Processing video…','#f59e0b');
              for(let i=0;i<15;i++){
                await new Promise(r=>setTimeout(r,3000));
                const s=await(await fetch(META_API+'/'+cr.id+'?fields=status_code',{headers:{'Authorization':'Bearer '+st}})).json();
                if(s.status_code==='FINISHED')break;
                if(s.status_code==='ERROR'){error='Video processing failed';break;}
              }
            }
            if (!error) {
              const pr=await(await fetch(META_API+'/'+cfg.META_IG_ID+'/media_publish',{method:'POST',
                headers:{'Authorization':'Bearer '+st,'Content-Type':'application/json'},
                body:JSON.stringify({creation_id:cr.id})})).json();
              if(pr.id){ok=true;postId=pr.id;}
              else error='Publish failed: '+(pr.error?.message||JSON.stringify(pr));
            }
          } else error='Container: '+(cr.error?.message||JSON.stringify(cr).slice(0,120));
        }
      }
      else if (ch==='instagram_story') {
        if (!cfg.META_IG_ID||!st) { error='Instagram not configured'; }
        else {
          const storyMp4 = pi['instagram_story_mp4'] || null;
          const storyImg = pi['instagram_story'] || pi['instagram_feed'] || item.image_url;
          const storyPayload = storyMp4
            ? {video_url:storyMp4, media_type:'STORIES'}
            : {image_url:storyImg, media_type:'STORIES'};
          const cr=await(await fetch(META_API+'/'+cfg.META_IG_ID+'/media',{method:'POST',
            headers:{'Authorization':'Bearer '+st,'Content-Type':'application/json'},
            body:JSON.stringify(storyPayload)})).json();
          if(cr.id){
            if (storyMp4) {
              setStatus(ch,'⏳','Processing story video…','#f59e0b');
              for(let i=0;i<15;i++){
                await new Promise(r=>setTimeout(r,3000));
                const s=await(await fetch(META_API+'/'+cr.id+'?fields=status_code',{headers:{'Authorization':'Bearer '+st}})).json();
                if(s.status_code==='FINISHED')break;
                if(s.status_code==='ERROR'){error='Story video processing failed';break;}
              }
            } else {
              await new Promise(r=>setTimeout(r,4000));
            }
            if (!error) {
              const pr=await(await fetch(META_API+'/'+cfg.META_IG_ID+'/media_publish',{method:'POST',
                headers:{'Authorization':'Bearer '+st,'Content-Type':'application/json'},
                body:JSON.stringify({creation_id:cr.id})})).json();
              if(pr.id){ok=true;postId=pr.id;}
              else error='Story publish: '+(pr.error?.message||pr.error?.error_user_msg||JSON.stringify(pr).slice(0,200));
            }
          } else error='Story container: '+(cr.error?.message||cr.error?.error_user_msg||JSON.stringify(cr).slice(0,200));
        }
      }
      else if (ch==='facebook_post') {
        if (!cfg.META_PAGE_ID||!st) { error='Facebook Page not configured'; }
        else {
          const pageIds = [cfg.META_PAGE_ID];
          if (cfg.META_PAGE_ID_2) pageIds.push(cfg.META_PAGE_ID_2);
          let anyOk = false;
          for (const pageId of pageIds) {
            const ptRes=await(await fetch(META_API+'/'+pageId+'?fields=access_token',{
              headers:{'Authorization':'Bearer '+st}})).json();
            const pageToken=ptRes.access_token||st;
            if(isVideo){
              const vr=await(await fetch(META_API+'/'+pageId+'/videos',{method:'POST',
                headers:{'Authorization':'Bearer '+pageToken,'Content-Type':'application/json'},
                body:JSON.stringify({file_url:img,description:cap})})).json();
              if(vr.id){anyOk=true;postId=vr.id;}else error=(error?error+' | ':'')+pageId+': '+(vr.error?.message||'Video failed');
            } else {
              const fr=await(await fetch(META_API+'/'+pageId+'/photos',{method:'POST',
                headers:{'Authorization':'Bearer '+pageToken,'Content-Type':'application/json'},
                body:JSON.stringify({url:img,caption:cap,published:true})})).json();
              if(fr.id){anyOk=true;postId=fr.id;}
              else error=(error?error+' | ':'')+pageId+': '+(fr.error?.message||JSON.stringify(fr).slice(0,80));
            }
          }
          ok = anyOk;
          if (ok) error = '';
        }
      }
      else if (ch==='facebook_story') {
        // FB Story requires special Pages Story permission — skip for now
        error='FB Story: requires pages_manage_posts + story permission (not yet enabled in your app)';
      }
      else if (ch==='threads') {
        if (!cfg.THREADS_NUMERIC_ID||!cfg.THREADS_ACCESS_TOKEN) { error='Threads not configured'; }
        else {
          const thImg = pi['instagram_feed']||pi['threads']||item.image_url; // PNG not GIF
          const pr = await(await fetch(MKT_SB_URL+'/functions/v1/social-proxy',{method:'POST',
            headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
            body:JSON.stringify({action:'post_threads',token:cfg.THREADS_ACCESS_TOKEN,
              numeric_id:cfg.THREADS_NUMERIC_ID,image_url:thImg,text:cap.slice(0,500)})})).json();
          if(pr.ok){ok=true;postId=pr.post_id;}
          else error='Threads: '+(pr.error||'Post failed');
        }
      }
      else if (ch==='whatsapp_story') {
        if (!cfg.META_WA_PHONE_ID||!cfg.META_WA_TOKEN) { error='WhatsApp not configured'; }
        else {
          const waTarget = document.querySelector('input[name="wa-target"]:checked')?.value || 'owner';
          const waTemplate = document.getElementById('wa-template-select')?.value || 'image';
          // WhatsApp: use static PNG for reliability (GIF works but PNG more compatible)
          const waImg = pi['instagram_feed'] || pi['story_gif'] || pi['square_gif'] || pi['instagram_story'] || item.image_url;
          const today = new Date();
          const validTill = new Date(today.getTime()+7*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short'});

          // Build message payload based on selected template
          const buildPayload = (to, name) => {
            if (waTemplate === 'image') {
              return {messaging_product:'whatsapp',recipient_type:'individual',to,type:'image',
                image:{link:waImg,caption:cap.slice(0,1024)}};
            }
            // Template params mapping
            const paramMap = {
              vwholesale_offer_alert: [(name||'there'),(item.topic||'').slice(0,60),validTill],
              vwholesale_new_arrival: [(name||'there'),(item.topic||'').slice(0,60)],
              vwholesale_visit_invite: [(name||'there')],
              vwholesale_contractor_invite: [(name||'there')],
              vwholesale_festival_greeting: [(item.topic||'this occasion').slice(0,60),(name||'there')],
              vwholesale_feedback_request: [(name||'there'),(item.topic||'products').slice(0,60)],
              vwholesale_welcome: [(name||'there')],
              vwholesale_quotation_ready: [(name||'there'),'QT'+Date.now().toString().slice(-4),'as discussed'],
              vwholesale_contractor_update: [(name||'there'),(item.topic||'').slice(0,60),'0'],
            };
            const params = (paramMap[waTemplate]||[(name||'there')]).map(text=>({type:'text',text:String(text).slice(0,60)}));
            return {messaging_product:'whatsapp',recipient_type:'individual',to,type:'template',
              template:{name:waTemplate,language:{code:'en'},
                components:[{type:'body',parameters:params}]}};
          };

          const sendWA = async (to, name) => {
            const r = await (await fetch(META_API+'/'+cfg.META_WA_PHONE_ID+'/messages',{
              method:'POST',headers:{'Authorization':'Bearer '+cfg.META_WA_TOKEN,'Content-Type':'application/json'},
              body:JSON.stringify(buildPayload(to,name))})).json();
            return r.messages?.[0]?.id||null;
          };

          if (waTarget === 'owner') {
            const ownerNum = cfg.META_WA_OWNER_PHONE || '919038010175';
            // Send new_arrival template with image header
            const r = await (await fetch(META_API+'/'+cfg.META_WA_PHONE_ID+'/messages',{
              method:'POST',headers:{'Authorization':'Bearer '+cfg.META_WA_TOKEN,'Content-Type':'application/json'},
              body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:ownerNum,
                type:'template',template:{name:'vwholesale_new_arrival',language:{code:'en'},
                  components:[
                    {type:'header',parameters:[{type:'image',image:{link:waImg}}]},
                    {type:'body',parameters:[
                      {type:'text',text:'Himansu'},
                      {type:'text',text:(item.topic||'New products').slice(0,60)}
                    ]}
                  ]}})})).json();
            if (r.messages?.[0]?.id) { ok=true; postId='wa_owner_'+r.messages[0].id; }
            else error='WA: '+(r.error?.message||r.error?.error_data?.details||JSON.stringify(r).slice(0,150));

          } else if (waTarget === 'select') {
            const rawNums = (document.getElementById('wa-phone-input')?.value||'').trim();
            if (!rawNums) { error='Enter at least one phone number'; }
            else {
              const nums = rawNums.split(/[,\s]+/).map(n=>'91'+n.replace(/[^0-9]/g,'').slice(-10)).filter(n=>n.length===12);
              if (!nums.length) { error='No valid 10-digit numbers found'; }
              else {
                let sent=0;
                for (const num of nums) { if(await sendWA(num,''))sent++; await new Promise(r=>setTimeout(r,300)); }
                if(sent>0){ok=true;postId='wa_'+sent+'_sent';}else error='All WA sends failed';
              }
            }

          } else { // all opted-in
            const {data:waCusts} = await sb.from('customers').select('name,phone').not('phone','is',null).eq('wa_opted_in',true).limit(200);
            if (!waCusts?.length) { error='No opted-in customers — set wa_opted_in=true in CRM first'; }
            else {
              let sent=0, lastErr='';
              for (const c of waCusts) {
                const num='91'+c.phone.replace(/[^0-9]/g,'').slice(-10);
                if(num.length!==12)continue;
                const msgId=await sendWA(num,c.name||'');
                if(msgId)sent++;else lastErr='Some sends failed';
                await new Promise(r=>setTimeout(r,300));
              }
              if(sent>0){ok=true;postId='wa_'+sent+'_sent';}else error='WA bulk failed: '+lastErr;
            }
          }
        }
      }
      else if (ch==='gbp'||ch==='google_business') { error='GBP API pending (~Aug 1)'; }
      else if (ch==='youtube'||ch==='youtube_shorts') {
        const isShort = ch==='youtube_shorts';
        // Video: use MP4 if available, else GIF
        const ytVid = pi['youtube_mp4']||pi['instagram_feed_mp4']||pi['mp4_music']||(isShort?(pi['instagram_story_mp4']||pi['story_gif']):null)||pi['square_gif']||item.image_url;
        const ytImg = pi['instagram_feed']||pi['facebook_post']||item.image_url;
        const ytTitle = (item.topic||'V Wholesale').slice(0,100);
        const ytDesc = (item.caption||'')+(item.hashtags?.length?'\n\n'+item.hashtags.join(' '):'')+'\n\nV Wholesale Vijayawada | Build Better, Pay Less\n📞 +91 8712697930 | 🌐 vwholesale.in';
        const ytTags = ['VWholesale','Vijayawada','HomeBuilding','BuildBetterPayLess',...(item.hashtags||[]).map(h=>h.replace('#',''))];

        if (!ytVid) {
          // Auto-generate: regen GIF then retry
          showMktUpdateStatus(ch, '⏳ No video — regenerating…');
          try {
            await calGenerateGif(item.id, null, 'cinematic', 'none');
            const{data:refreshed}=await sb.from('content_calendar').select('platform_images').eq('id',item.id).single();
            const rpi=refreshed?.platform_images||{};
            const retryVid=rpi['youtube_mp4']||rpi['instagram_feed_mp4']||rpi['mp4_music']||rpi['square_gif']||item.image_url;
            if(retryVid){
              const ytRes2=await(await fetch(MKT_SB_URL+'/functions/v1/youtube-upload',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'upload_video',video_url:retryVid,title:ytTitle,description:ytDesc.slice(0,5000),tags:ytTags.slice(0,15),privacy:'public',is_short:isShort})})).json();
              if(ytRes2.ok){ok=true;postId=ytRes2.video_id;}
              else error='YouTube (after regen): '+(ytRes2.error||'Upload failed');
            } else { error='No video even after regen'; }
          } catch(regenErr) { error='Auto-regen failed: '+regenErr.message; }
        }
        else {
          const ytRes = await (await fetch(MKT_SB_URL+'/functions/v1/youtube-upload',{
            method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
            body:JSON.stringify({action:'upload_video',video_url:ytVid,title:ytTitle,
              description:ytDesc.slice(0,5000),tags:ytTags.slice(0,15),privacy:'public',is_short:isShort})
          })).json();
          if(ytRes.ok){ok=true;postId=ytRes.video_id;}
          else error='YouTube'+(isShort?' Shorts':'')+': '+(ytRes.error||'Upload failed');
        }
      }
      else if (ch==='youtube_community') {
        const ytImg = pi['instagram_feed']||pi['facebook_post']||item.image_url;
        const ytText = (item.caption||item.topic||'').slice(0,2000)+(item.hashtags?.length?'\n\n'+item.hashtags.join(' '):'');
        const ytRes = await (await fetch(MKT_SB_URL+'/functions/v1/youtube-upload',{
          method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body:JSON.stringify({action:'community_post',image_url:ytImg,text:ytText})
        })).json();
        if(ytRes.ok){ok=true;postId=ytRes.post_id;}
        else error='YT Community: '+(ytRes.error||'Post failed');
      }
      else { error='Channel not yet implemented: '+ch; }
    } catch(e) { error=e.message||'Unknown error'; }

    results[ch]={ok,postId,error};
    if(ok){
      setStatus(ch,'✅','Posted!','#22c55e');
      await sb.from('channel_deliveries').upsert({calendar_id:parseInt(calendarId),channel:ch,status:'published',platform_post_id:postId,published_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'calendar_id,channel'});
    } else {
      setStatus(ch,'❌',error||'Failed','#ef4444');
      await sb.from('channel_deliveries').upsert({calendar_id:parseInt(calendarId),channel:ch,status:'failed',error_message:error,updated_at:new Date().toISOString()},{onConflict:'calendar_id,channel'});
    }
    await new Promise(r=>setTimeout(r,400));
  }


  const succeeded = Object.values(results).filter(r=>r.ok).length;
  const errLog = Object.entries(results).filter(([,r])=>!r.ok).map(([ch,r])=>ch+': '+r.error).join('\n');
  if(btn){
    btn.textContent = succeeded+'/'+channels.length+' channels posted';
    btn.style.background = succeeded>0?'#166534':'#7f1d1d';
  }
  // Show error log in popup — stays open so you can read it
  const popContent = document.querySelector('#postnow-popup > div');
  if(popContent) {
    const logDiv = document.createElement('div');
    logDiv.style.cssText = 'margin-top:12px;background:#0f172a;border-radius:8px;padding:10px;border:1px solid '+(errLog?'#ef4444':'#22c55e');
    logDiv.innerHTML = succeeded===channels.length
      ? '<div style="font-size:12px;color:#22c55e;font-weight:700">✅ All channels posted successfully!</div>'
      : '<div style="font-size:10px;font-weight:700;color:#ef4444;margin-bottom:6px">❌ ERRORS — tap to copy all</div><pre style="font-size:10px;color:#94a3b8;white-space:pre-wrap;word-break:break-all;margin:0;cursor:pointer" onclick="navigator.clipboard.writeText(this.textContent).then(()=>showMktToast(\'Copied\',2000))">'+errLog+'</pre>';
    popContent.appendChild(logDiv);
  }
  if(succeeded>0){
    await sb.from('content_calendar').update({status:'published',published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',calendarId);
    renderCalendar();
  }
}


async function calPostNowDebug(calendarId) {
  try {
  const { data: settings } = await sb.from('marketing_settings').select('key,value')
    .in('key', ['META_IG_ID','META_PAGE_ID','META_PAGE_ID_2','META_SYSTEM_USER_TOKEN','THREADS_ACCESS_TOKEN','THREADS_NUMERIC_ID','META_WA_PHONE_ID','META_WA_TOKEN','META_WA_OWNER_PHONE']);
  const cfg = {}; (settings||[]).forEach(s => cfg[s.key] = s.value);
  const st = cfg['META_SYSTEM_USER_TOKEN'];
  const META = 'https://graph.facebook.com/v25.0';

  const popContent = document.querySelector('#postnow-popup > div') || document.getElementById('postnow-popup');
  if (!popContent) { showMktToast('❌ Popup not found — open Post Now first'); return; }
  document.getElementById('postnow-debug-div')?.remove();
  const debugDiv = document.createElement('div');
  debugDiv.id = 'postnow-debug-div';
  debugDiv.style.cssText = 'margin-top:12px;background:#0f172a;border-radius:8px;padding:12px;border:1px solid #334155;font-size:10px;color:#94a3b8;max-height:300px;overflow-y:auto';
  debugDiv.innerHTML = '<div style="color:#c9a84c;font-weight:700;margin-bottom:8px">🔍 Running diagnostics…</div>';
  popContent.appendChild(debugDiv);

  const log = (msg, color) => {
    const c = color || '#94a3b8';
    const div = document.createElement('div');
    div.style.color = c;
    div.style.marginBottom = '3px';
    div.textContent = msg;
    debugDiv.appendChild(div);
  };

  // 1. Token check
  try {
    const me = await (await fetch(META+'/me?fields=id,name', {headers:{'Authorization':'Bearer '+st}})).json();
    log(me.id ? '✅ Token valid — '+me.name+' ('+me.id+')' : '❌ Token invalid: '+(me.error?.message||''), me.id?'#22c55e':'#ef4444');
  } catch(e) { log('❌ Token check: '+e.message, '#ef4444'); }

  // 2. Pages + IG check
  try {
    const pages = await (await fetch(META+'/me/accounts?fields=id,name,instagram_business_account{id,username},access_token', {headers:{'Authorization':'Bearer '+st}})).json();
    if (pages.data?.length) {
      pages.data.forEach(function(p) {
        log('📘 Page: '+p.name+' ('+p.id+')', '#3b82f6');
        if (p.instagram_business_account) log('  📸 IG Business: @'+p.instagram_business_account.username+' ('+p.instagram_business_account.id+')', '#22c55e');
        else log('  ⚠️ No IG Business account linked to this page', '#f59e0b');
      });
    } else log('❌ No pages: '+JSON.stringify(pages.error||pages).slice(0,100), '#ef4444');
    const storedIg = cfg['META_IG_ID'];
    const correctIg = pages.data?.find(function(p){return p.instagram_business_account;})?.instagram_business_account?.id;
    if (correctIg && correctIg !== storedIg) log('⚠️ Stored IG_ID ('+storedIg+') ≠ actual ('+correctIg+') — needs update!', '#f59e0b');
    else if (correctIg && correctIg === storedIg) log('✅ IG_ID correct: '+storedIg, '#22c55e');
    else if (!correctIg) log('⚠️ No IG Business account found on any page', '#f59e0b');
  } catch(e) { log('❌ Pages check: '+e.message, '#ef4444'); }

  // 3. Threads token check
  try {
    const thProxy = await (await fetch(MKT_SB_URL+'/functions/v1/social-proxy', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({action:'verify_threads',token:cfg['THREADS_ACCESS_TOKEN'],numeric_id:cfg['THREADS_NUMERIC_ID']})
    })).json();
    const thErr = thProxy.error || JSON.stringify(thProxy).slice(0,100);
    if (thProxy.ok) {
      log('✅ Threads token valid — @'+thProxy.username+' ('+thProxy.id+')', '#22c55e');
      if (thProxy.id !== cfg['THREADS_NUMERIC_ID']) {
        log('⚠️ Stored THREADS_NUMERIC_ID ('+cfg['THREADS_NUMERIC_ID']+') ≠ actual ('+thProxy.id+') — updating…', '#f59e0b');
        await sb.from('marketing_settings').upsert({key:'THREADS_NUMERIC_ID',value:thProxy.id,updated_at:new Date().toISOString()},{onConflict:'key'});
        log('✅ THREADS_NUMERIC_ID auto-updated to '+thProxy.id, '#22c55e');
      }
    } else {
      log('❌ Threads: '+thErr, '#ef4444');
    }
  } catch(e) { log('❌ Threads check: '+e.message, '#ef4444'); }

  // 4. WhatsApp check
  try {
    const wa = await (await fetch(META+'/'+cfg['META_WA_PHONE_ID']+'?fields=id,display_phone_number,verified_name', {headers:{'Authorization':'Bearer '+cfg['META_WA_TOKEN']}})).json();
    log(wa.id ? '✅ WhatsApp: '+wa.verified_name+' ('+wa.display_phone_number+')' : '❌ WA: '+(wa.error?.message||JSON.stringify(wa).slice(0,80)), wa.id?'#22c55e':'#ef4444');
    const waTemplRes = await (await fetch(MKT_SB_URL+'/functions/v1/social-proxy', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({action:'wa_templates',waba_id:'1183561931509509',wa_phone_id:cfg['META_WA_PHONE_ID'],wa_token:cfg['META_WA_TOKEN']})
    })).json();
    if (waTemplRes.ok && waTemplRes.data?.length) {
      log('✅ WA Templates ('+waTemplRes.data.length+'): '+waTemplRes.data.map(function(t){return t.name+' ('+t.status+')';}).slice(0,5).join(', '), '#22c55e');
    } else if (!waTemplRes.ok) {
      log('❌ WA Templates: '+(waTemplRes.error||'Failed to load'), '#ef4444');
    } else {
      log('ℹ️ No WA templates found — image sends work without templates', '#f59e0b');
    }
  } catch(e) { log('❌ WA check: '+e.message, '#ef4444'); }

  // YouTube check
  try {
    const ytRows = await sb.from('marketing_settings').select('key,value').in('key',['YOUTUBE_REFRESH_TOKEN','YOUTUBE_CHANNEL_NAME','YOUTUBE_SUBSCRIBER_COUNT']);
    const ytCfg = {}; (ytRows.data||[]).forEach(r=>ytCfg[r.key]=r.value);
    if (ytCfg.YOUTUBE_REFRESH_TOKEN) {
      log('✅ YouTube connected — '+ytCfg.YOUTUBE_CHANNEL_NAME+' ('+ytCfg.YOUTUBE_SUBSCRIBER_COUNT+' subscribers)', '#22c55e');
    } else {
      log('❌ YouTube not connected — go to /youtube-auth.html', '#ef4444');
    }
  } catch(e) { log('❌ YouTube check: '+e.message, '#ef4444'); }

  log('─── Diagnostics complete ───', '#334155');
  } catch(e) { showMktToast('❌ Debug error: '+e.message, 5000); console.error('Debug error:', e); }
}
window.calPostNowDebug = calPostNowDebug;

window.calPostNow = calPostNow;
window.calPostNowExecute = calPostNowExecute;

window.calPreviewPost = calPreviewPost;
window.calApproveItem = calApproveItem;
window.calUnapproveItem = calUnapproveItem;
// ── GENERATION HISTORY ──────────────────────────────────────────────────

async function saveToHistory(calendarId, type, data) {
  try {
    const { data: item } = await sb.from('content_calendar').select('topic,content_type').eq('id', calendarId).single();
    
    // Insert new history row
    const { data: inserted, error: insertErr } = await sb.from('generation_history').insert({
      calendar_id:    parseInt(calendarId),
      topic:          item?.topic || '',
      content_type:   type,
      anim_style:     data.anim_style || null,
      offer_text:     data.offer_text || null,
      image_url:      data.image_url || null,
      platform_images: data.platform_images || null,
      caption_en:     data.caption_en || null,
      caption_te:     data.caption_te || null,
      hashtags:       data.hashtags || null,
      poster_message: data.poster_message || null,
      prompt_summary: data.prompt_summary || type,
      generation_ms:  data.generation_ms || null,
      is_active:      true,
      created_at:     new Date().toISOString()
    }).select('id').single();

    if (insertErr) {
      console.error('saveToHistory insert failed:', insertErr);
      return;
    }

    // Mark all OTHER rows for this calendar_id as inactive
    if (inserted?.id) {
      await sb.from('generation_history')
        .update({ is_active: false })
        .eq('calendar_id', parseInt(calendarId))
        .neq('id', inserted.id);
    }
  } catch(e) { console.error('saveToHistory error:', e); }
}

async function openHistoryDrawer(calendarId) {
  const drawerId = 'hist-drawer-' + calendarId;
  const existing = document.getElementById(drawerId);
  if (existing) { existing.remove(); return; }

  const container = document.getElementById('cal-row-' + calendarId);
  if (!container) return;

  const { data: rows } = await sb.from('generation_history')
    .select('*').eq('calendar_id', calendarId)
    .order('created_at', { ascending: false }).limit(50);

  if (!rows?.length) { showMktToast('No history yet for this post', 3000); return; }

  const TYPE_LABEL = { poster:'🖼️ Poster', gif_slideshow:'🎞️ Slideshow GIF', gif_animated:'🎬 Animated GIF', caption:'📝 Caption' };

  const drawer = document.createElement('div');
  drawer.id = drawerId;
  drawer.style.cssText = 'margin-top:8px;background:#0f172a;border-radius:10px;padding:14px;border:1px solid #334155';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:700;color:#94a3b8';
  title.textContent = '🕐 Generation History — ' + rows.length + ' version' + (rows.length>1?'s':'');
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;color:#64748b;cursor:pointer;font-size:16px';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => drawer.remove();
  header.appendChild(title); header.appendChild(closeBtn);
  drawer.appendChild(header);

  // Items
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  rows.forEach(function(r) {
    const date = new Date(r.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const thumbUrl = (r.platform_images && (r.platform_images.instagram_feed || r.platform_images.square_gif)) || r.image_url;
    const gifUrl = r.platform_images && (r.platform_images.square_gif || r.platform_images.gif);
    const displayUrl = gifUrl || thumbUrl;
    const label = TYPE_LABEL[r.content_type] || r.content_type;
    const isActive = r.is_active;

    const item = document.createElement('div');
    item.style.cssText = 'background:#1e293b;border-radius:8px;padding:10px;border:1px solid ' + (isActive?'#c9a84c':'#334155') + ';display:flex;gap:10px;align-items:flex-start';

    // Thumbnail
    if (displayUrl) {
      const img = document.createElement('img');
      img.src = displayUrl;
      img.style.cssText = 'width:60px;height:60px;object-fit:contain;border-radius:6px;cursor:pointer;background:#0f172a;flex-shrink:0';
      img.title = 'Click to expand';
      img.onclick = function() { openMktLightbox(displayUrl, label + ' — ' + date, displayUrl, 'history_' + r.id + '.' + (gifUrl?'gif':'png')); };
      item.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = 'width:60px;height:60px;background:#0f172a;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#475569;font-size:10px';
      ph.textContent = 'No img';
      item.appendChild(ph);
    }

    // Info
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:11px;font-weight:700;color:#f1f5f9';
    lbl.textContent = label;
    meta.appendChild(lbl);
    if (isActive) {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:9px;background:rgba(201,168,76,.2);color:#c9a84c;padding:1px 6px;border-radius:4px;font-weight:700';
      badge.textContent = 'ACTIVE';
      meta.appendChild(badge);
    }
    if (r.anim_style) {
      const styleTag = document.createElement('span');
      styleTag.style.cssText = 'font-size:9px;background:#1e293b;color:#64748b;padding:1px 5px;border-radius:3px';
      styleTag.textContent = r.anim_style;
      meta.appendChild(styleTag);
    }
    info.appendChild(meta);

    const dateEl = document.createElement('div');
    dateEl.style.cssText = 'font-size:10px;color:#64748b;margin-bottom:4px';
    dateEl.textContent = date;
    info.appendChild(dateEl);

    if (r.offer_text) {
      const offer = document.createElement('div');
      offer.style.cssText = 'font-size:10px;color:#c9a84c';
      offer.textContent = '💰 ' + r.offer_text;
      info.appendChild(offer);
    }
    if (r.poster_message) {
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      msg.textContent = r.poster_message.slice(0, 60);
      info.appendChild(msg);
    }

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap';
    if (!isActive) {
      const useBtn = document.createElement('button');
      useBtn.style.cssText = 'background:#c9a84c;border:none;color:#111;font-size:10px;font-weight:700;padding:4px 10px;border-radius:5px;cursor:pointer';
      useBtn.textContent = '✅ Use This';
      useBtn.onclick = function() { useHistoryVersion(r.id, calendarId); };
      actions.appendChild(useBtn);
    } else {
      const activeLabel = document.createElement('span');
      activeLabel.style.cssText = 'font-size:10px;color:#c9a84c';
      activeLabel.textContent = '✓ Currently active';
      actions.appendChild(activeLabel);
    }
    if (displayUrl) {
      const dl = document.createElement('a');
      dl.href = displayUrl;
      dl.download = '';
      dl.target = '_blank';
      dl.style.cssText = 'font-size:10px;color:#64748b;padding:4px 8px;border:1px solid #334155;border-radius:5px;text-decoration:none';
      dl.textContent = '⬇ Download';
      actions.appendChild(dl);
    }
    info.appendChild(actions);
    item.appendChild(info);
    list.appendChild(item);
  });

  drawer.appendChild(list);
  container.appendChild(drawer);
}


async function useHistoryVersion(historyId, calendarId) {
  const { data: row } = await sb.from('generation_history').select('*').eq('id', historyId).single();
  if (!row) { showMktNotif('❌ History version not found'); return; }

  // Restore this version to the calendar
  const update = { updated_at: new Date().toISOString() };
  if (row.image_url) update.image_url = row.image_url;
  if (row.platform_images) update.platform_images = row.platform_images;
  if (row.caption_en) update.caption = row.caption_en;
  if (row.caption_te) update.caption_te = row.caption_te;
  if (row.hashtags) update.hashtags = row.hashtags;
  if (row.poster_message) update.poster_message = row.poster_message;
  update.status = 'ready';

  await sb.from('content_calendar').update(update).eq('id', calendarId);

  // Mark this as active in history
  await sb.from('generation_history').update({ is_active: false }).eq('calendar_id', calendarId);
  await sb.from('generation_history').update({ is_active: true }).eq('id', historyId);

  // Remove drawer and refresh
  document.getElementById('hist-drawer-' + calendarId)?.remove();
  showMktNotif('✅ Version restored — ' + (row.content_type || 'output') + ' from ' + new Date(row.created_at).toLocaleDateString('en-IN'));
  renderCalendar();
}

window.openHistoryDrawer = openHistoryDrawer;
window.useHistoryVersion = useHistoryVersion;
window.saveToHistory = saveToHistory;

window.calGenerateGif = calGenerateGif;
window.showGifOptionsPopup = showGifOptionsPopup;
window.gifSelectMode = gifSelectMode;
window.gifStartGenerate = gifStartGenerate;

window.editCalendarItemById = editCalendarItemById;
// Expose render functions on window for lazy nav lookup
window.renderComingSoon = renderComingSoon;
window.renderApprovals = renderApprovals;
window.renderGBP = renderGBP;
window.renderAgents = renderAgents;
window.renderBrandProfile = renderBrandProfile;
window.renderBrand = renderBrand;
window.renderIntegrations = renderIntegrations;
window.renderCommandCentre = renderCommandCentre;
window.renderAICMO = renderAICMO;
window.renderContentStudio = renderContentStudio;
window.renderCalendar = renderCalendar;
window.renderAnalytics = renderAnalytics;

// ── STUDIO STUBS (overridden by marketing-gif.js at load time) ──
window.studioGenerate = window.studioGenerate || async function(brief, tone, mode) {
  showMktToast('⏳ Loading studio… please wait', 2000);
  setTimeout(() => window.studioGenerate && window.studioGenerate(brief, tone, mode), 2000);
};
window.studioSaveToCalendar = window.studioSaveToCalendar || async function() {};
