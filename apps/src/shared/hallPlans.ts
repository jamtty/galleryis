/**
 * 전시장 도면 좌표 — 원본 사이트(3D 스튜디오)의 값입니다.
 *
 * 원본 스튜디오는 방을 **정밀 도면 좌표**로 그립니다(바닥 폴리곤·문·창·바닥재·
 * 소화기·데스크). 우리 관리자 DB 에는 없는 값이라, 원본 공개 API
 * `https://galleryis.web.app/api/halls/<id>` 에서 받아 여기에 고정해 두었습니다.
 * (2026-09-19 · 사장님 확인 후 옮김. 값 자체는 원본 그대로입니다)
 *
 * ⚠ 이 파일은 생성물에 가깝습니다 — 도면이 바뀌면 관리자 화면이 아니라 여기를 고쳐야 합니다.
 */

/** 원본 `Hall` 의 방을 만드는 부분만 (요금·사진은 우리 DB 가 원천입니다) */
export type HallPlan = {
  id: string
  floor: string
  name_ko: string
  name_en: string
  area_m2: number
  pyeong: number
  ceiling_cm: number
  footprint: readonly { x: number; z: number }[]
  door: { wall_index: number; offset_m: number; width_cm: number; height_cm: number } | null
  desk: {
    center: { x: number; z: number }
    width_m: number
    depth_m: number
    height_cm: number
  } | null
  windows:
    | readonly {
        wall_index: number
        offset_m: number
        width_m: number
        sill_cm: number
        head_cm: number
      }[]
    | null
  floor_finish: { color: string; tile_cm: number | null; gloss: number } | null
  extinguishers: readonly { wall_index: number; offset_m: number }[] | null
}

export const HALL_PLANS: Record<string, HallPlan> = {
  "hall1": {
    "id": "hall1",
    "floor": "1F",
    "name_ko": "제1전시장",
    "name_en": "Exhibition Hall 1",
    "area_m2": 181,
    "pyeong": 55,
    "ceiling_cm": 280,
    "footprint": [
      {
        "z": 0,
        "x": 0
      },
      {
        "z": -7.7,
        "x": 0
      },
      {
        "z": -7.7,
        "x": -2.45
      },
      {
        "z": -11.2,
        "x": -2.45
      },
      {
        "z": -7,
        "x": 9.3
      },
      {
        "z": 0,
        "x": 6.42
      }
    ],
    "door": {
      "height_cm": 210,
      "wall_index": 0,
      "offset_m": 0.86,
      "width_cm": 85
    },
    "desk": {
      "center": {
        "z": -2.66,
        "x": 1.27
      },
      "depth_m": 1.83,
      "width_m": 0.38,
      "height_cm": 100
    },
    "windows": [
      {
        "head_cm": 250,
        "width_m": 5.6,
        "offset_m": 3.06,
        "sill_cm": 0,
        "wall_index": 5
      }
    ],
    "floor_finish": {
      "gloss": 0.55,
      "tile_cm": 30,
      "color": "#4b4842"
    },
    "extinguishers": [
      {
        "offset_m": 0.19,
        "wall_index": 0
      }
    ]
  },
  "hall2": {
    "id": "hall2",
    "floor": "2F",
    "name_ko": "제2전시장",
    "name_en": "Exhibition Hall 2",
    "area_m2": 181,
    "pyeong": 55,
    "ceiling_cm": 300,
    "footprint": [
      {
        "z": 0,
        "x": 0
      },
      {
        "z": -8.3,
        "x": 0
      },
      {
        "z": -8.3,
        "x": -2.7
      },
      {
        "z": -11.2,
        "x": -2.7
      },
      {
        "z": -7.1,
        "x": 9.2
      },
      {
        "z": 0,
        "x": 6.46
      }
    ],
    "door": {
      "height_cm": 210,
      "wall_index": 0,
      "offset_m": 1.05,
      "width_cm": 79
    },
    "desk": {
      "center": {
        "z": -2.79,
        "x": 1.21
      },
      "depth_m": 1.78,
      "width_m": 0.4,
      "height_cm": 100
    },
    "windows": [],
    "floor_finish": {
      "gloss": 0.62,
      "tile_cm": null,
      "color": "#8f938b"
    },
    "extinguishers": [
      {
        "offset_m": 0.3,
        "wall_index": 0
      }
    ]
  },
  "hall3": {
    "id": "hall3",
    "floor": "3F",
    "name_ko": "제3전시장",
    "name_en": "Exhibition Hall 3",
    "area_m2": 181,
    "pyeong": 55,
    "ceiling_cm": 300,
    "footprint": [
      {
        "z": 0,
        "x": 0
      },
      {
        "z": -10.07,
        "x": 0
      },
      {
        "z": -13.7,
        "x": 0
      },
      {
        "z": -13.7,
        "x": -0.12
      },
      {
        "z": -10.07,
        "x": -0.12
      },
      {
        "z": -10.07,
        "x": -2.74
      },
      {
        "z": -15.92,
        "x": -2.48
      },
      {
        "z": -16.51,
        "x": -2.19
      },
      {
        "z": -9.17,
        "x": 8.84
      },
      {
        "z": 0,
        "x": 6.48
      }
    ],
    "door": {
      "height_cm": 210,
      "wall_index": 0,
      "offset_m": 1.05,
      "width_cm": 79
    },
    "desk": {
      "center": {
        "z": -2.79,
        "x": 1.21
      },
      "depth_m": 1.78,
      "width_m": 0.4,
      "height_cm": 100
    },
    "windows": [],
    "floor_finish": {
      "gloss": 0.68,
      "tile_cm": null,
      "color": "#8b918a"
    },
    "extinguishers": [
      {
        "offset_m": 0.3,
        "wall_index": 0
      }
    ]
  },
  "hall4": {
    "id": "hall4",
    "floor": "B1",
    "name_ko": "제4전시장",
    "name_en": "Exhibition Hall 4",
    "area_m2": 172,
    "pyeong": 52,
    "ceiling_cm": 280,
    "footprint": [
      {
        "z": 0,
        "x": 0
      },
      {
        "z": -7.4,
        "x": 0
      },
      {
        "z": -7.4,
        "x": -2.4
      },
      {
        "z": -10.6,
        "x": -2.4
      },
      {
        "z": -7.1,
        "x": 9.2
      },
      {
        "z": 0,
        "x": 6.55
      }
    ],
    "door": {
      "height_cm": 210,
      "wall_index": 0,
      "offset_m": 0.41,
      "width_cm": 79
    },
    "desk": {
      "center": {
        "z": -2.33,
        "x": 1.32
      },
      "depth_m": 1.92,
      "width_m": 0.42,
      "height_cm": 100
    },
    "windows": [],
    "floor_finish": {
      "gloss": 0.66,
      "tile_cm": null,
      "color": "#9aa096"
    },
    "extinguishers": [
      {
        "offset_m": 1.05,
        "wall_index": 0
      }
    ]
  }
}
