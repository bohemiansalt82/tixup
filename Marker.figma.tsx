import figma from "@figma/code-connect"

/**
 * Marker 컴포넌트 연결 설정
 * 피그마의 'Marker' 컴포넌트와 CSS 기반 HTML 코드를 매핑합니다.
 */
figma.connect(
  "https://www.figma.com/design/xwanZD5vsxAboXxX1t58FC/Tixup?node-id=37552-6706",
  {
    props: {
      color: figma.enum("Color", {
        Pending: "pending",
        InProgress: "inprogress",
        Pause: "pause",
        Done: "done",
        Overdue: "overdue",
        Drop: "drop",
        "Depart 1": "depart-1",
        "Depart 2": "depart-2",
        "Depart 3": "depart-3",
        "Depart 4": "depart-4",
        "Depart 5": "depart-5",
        "Depart 6": "depart-6",
        "Depart 7": "depart-7",
        "Depart 8": "depart-8",
      }),
      icon: figma.enum("Icon", {
        Yes: true,
        No: false,
      })
    },
    example: ({ color, icon }) => {
      const isGhost = icon ? "marker-has-icon" : ""

      return (
        <div className={`marker marker-${color} ${isGhost}`}>
          Marker Content
        </div>
      )
    },
  }
)
