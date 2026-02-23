/**
 * 拼豆图纸生成器 - 全局常量与色卡数据
 */

export const PALETTES = {
    mard: [
        // 严格根据 guige.png 进行重新核对
        
        // --- 数字组 (1, 2, 3, 4) ---
        // 第 1 组 (24色)
        { id: 'B3', r: 184, g: 254, b: 190, groups: ['1']  }, // #B8FEBE
        { id: 'C3', r: 191, g: 236, b: 255, groups: ['1']  }, // #BFECFF
        { id: 'D9', r: 214, g: 186, b: 245, groups: ['1']  }, // #D6BAF5
        { id: 'E2', r: 255, g: 210, b: 232, groups: ['1']  }, // #FFD2E8
        { id: 'G1', r: 253, g: 238, b: 215, groups: ['1']  }, // #FDEED7
        { id: 'A4', r: 255, g: 241, b: 94, groups: ['1']  }, // #FFF15E
        { id: 'B5', r: 79, g: 223, b: 104, groups: ['1']  }, // #4FDF68
        { id: 'C5', r: 44, g: 178, b: 235, groups: ['1']  }, // #2CB2EB
        { id: 'D6', r: 169, g: 125, b: 220, groups: ['1']  }, // #A97DDC
        { id: 'E4', r: 237, g: 127, b: 175, groups: ['1']  }, // #ED7FAF
        { id: 'G5', r: 237, g: 158, b: 96, groups: ['1']  }, // #ED9E60
        { id: 'A6', r: 255, g: 196, b: 69, groups: ['1']  }, // #FFC445
        { id: 'B8', r: 8, g: 164, b: 71, groups: ['1']  }, // #08A447
        { id: 'C8', r: 26, g: 100, b: 194, groups: ['1']  }, // #1A64C2
        { id: 'D7', r: 126, g: 71, b: 163, groups: ['1']  }, // #7E47A3
        { id: 'F5', r: 210, g: 74, b: 68, groups: ['1']  }, // #D24A44
        { id: 'G7', r: 162, g: 111, b: 74, groups: ['1']  }, // #A26F4A
        { id: 'A7', r: 255, g: 148, b: 53, groups: ['1']  }, // #FF9435
        { id: 'H1', r: 251, g: 251, b: 253, groups: ['1']  }, // #FBFBFD
        { id: 'H2', r: 255, g: 254, b: 255, groups: ['1']  }, // #FFFEFF
        { id: 'H3', r: 187, g: 187, b: 187, groups: ['1']  }, // #BBBBBB
        { id: 'H4', r: 136, g: 132, b: 139, groups: ['1']  }, // #88848B
        { id: 'H5', r: 73, g: 71, b: 77, groups: ['1']  }, // #49474D
        { id: 'H7', r: 5, g: 5, b: 5, groups: ['1']  }, // #050505

        // 第 2 组 (48色)
        { id: 'C2', r: 210, g: 250, b: 255, groups: ['2']  }, // #D2FAFF
        { id: 'C13', r: 206, g: 232, b: 255, groups: ['2']  }, // #CEE8FF
        { id: 'D19', r: 234, g: 213, b: 231, groups: ['2']  }, // #EAD5E7
        { id: 'E8', r: 255, g: 230, b: 235, groups: ['2']  }, // #FFE6EB
        { id: 'A13', r: 251, g: 200, b: 76, groups: ['2']  }, // #FBC84C
        { id: 'A11', r: 253, g: 215, b: 154, groups: ['2']  }, // #FDD79A
        { id: 'C10', r: 75, g: 183, b: 225, groups: ['2']  }, // #4BB7E1
        { id: 'C6', r: 125, g: 187, b: 237, groups: ['2']  }, // #7DBBED
        { id: 'D18', r: 155, g: 100, b: 194, groups: ['2']  }, // #9B64C2
        { id: 'E3', r: 246, g: 178, b: 205, groups: ['2']  }, // #F6B2CD
        { id: 'A10', r: 253, g: 169, b: 84, groups: ['2']  }, // #FDA954
        { id: 'G9', r: 242, g: 190, b: 144, groups: ['2']  }, // #F2BE90
        { id: 'C11', r: 35, g: 198, b: 211, groups: ['2']  }, // #23C6D3
        { id: 'C7', r: 62, g: 146, b: 219, groups: ['2']  }, // #3E92DB
        { id: 'D21', r: 150, g: 56, b: 150, groups: ['2']  }, // #963896
        { id: 'D13', r: 208, g: 12, b: 150, groups: ['2']  }, // #D00C96
        { id: 'F13', r: 228, g: 79, b: 63, groups: ['2']  }, // #E44F3F
        { id: 'G13', r: 182, g: 123, b: 89, groups: ['2']  }, // #B67B59
        { id: 'B12', r: 0, g: 147, b: 109, groups: ['2']  }, // #00936D
        { id: 'D3', r: 25, g: 62, b: 176, groups: ['2']  }, // #193EB0
        { id: 'D15', r: 10, g: 54, b: 91, groups: ['2']  }, // #0A365B
        { id: 'E7', r: 156, g: 2, b: 78, groups: ['2']  }, // #9C024E
        { id: 'F8', r: 160, g: 64, b: 55, groups: ['2']  }, // #A04037
        { id: 'G8', r: 74, g: 45, b: 27, groups: ['2']  }, // #4A2D1B

        // 第 3 组 (72色)
        { id: 'A3', r: 255, g: 255, b: 140, groups: ['3']  }, // #FFFF8C
        { id: 'B20', r: 216, g: 249, b: 219, groups: ['3']  }, // #D8F9DB
        { id: 'D16', r: 227, g: 237, b: 253, groups: ['3']  }, // #E3EDFD
        { id: 'D8', r: 228, g: 211, b: 255, groups: ['3']  }, // #E4D3FF
        { id: 'E1', r: 254, g: 230, b: 223, groups: ['3']  }, // #FEE6DF
        { id: 'G2', r: 255, g: 217, b: 192, groups: ['3']  }, // #FFD9C0
        { id: 'B18', r: 224, g: 241, b: 70, groups: ['3']  }, // #E0F146
        { id: 'B10', r: 124, g: 212, b: 187, groups: ['3']  }, // #7CD4BB
        { id: 'D11', r: 180, g: 187, b: 239, groups: ['3']  }, // #B4BBEF
        { id: 'D12', r: 230, g: 176, b: 241, groups: ['3']  }, // #E6B0F1
        { id: 'E12', r: 254, g: 167, b: 213, groups: ['3']  }, // #FEA7D5
        { id: 'G3', r: 244, g: 205, b: 166, groups: ['3']  }, // #F4CDA6
        { id: 'B14', r: 234, g: 254, b: 200, groups: ['3']  }, // #EAFEC8
        { id: 'B19', r: 41, g: 184, b: 150, groups: ['3']  }, // #29B896
        { id: 'D2', r: 134, g: 149, b: 220, groups: ['3']  }, // #8695DC
        { id: 'D20', r: 157, g: 85, b: 183, groups: ['3']  }, // #9D55B7
        { id: 'E5', r: 232, g: 89, b: 158, groups: ['3']  }, // #E8599E
        { id: 'F10', r: 150, g: 85, b: 56, groups: ['3']  }, // #965538
        { id: 'B17', r: 192, g: 214, b: 89, groups: ['3']  }, // #C0D659
        { id: 'B7', r: 11, g: 165, b: 142, groups: ['3']  }, // #0BA58E
        { id: 'C16', r: 42, g: 91, b: 143, groups: ['3']  }, // #2A5B8F
        { id: 'D14', r: 157, g: 62, b: 158, groups: ['3']  }, // #9D3E9E
        { id: 'E13', r: 151, g: 5, b: 102, groups: ['3']  }, // #970566
        { id: 'F7', r: 134, g: 34, b: 38, groups: ['3']  }, // #862226

        // 第 4 组 (96色)
        { id: 'E11', r: 254, g: 232, b: 219, groups: ['4']  }, // #FEE8DB
        { id: 'E14', r: 255, g: 218, b: 193, groups: ['4']  }, // #FFDAC1
        { id: 'F1', r: 254, g: 143, b: 116, groups: ['4']  }, // #FE8F74
        { id: 'A14', r: 251, g: 109, b: 81, groups: ['4']  }, // #FB6D51
        { id: 'M6', r: 176, g: 167, b: 129, groups: ['4']  }, // #B0A781
        { id: 'M5', r: 209, g: 204, b: 169, groups: ['4']  }, // #D1CCA9
        { id: 'E15', r: 254, g: 225, b: 226, groups: ['4']  }, // #FEE1E2
        { id: 'F14', r: 254, g: 182, b: 182, groups: ['4']  }, // #FEB6B6
        { id: 'F9', r: 254, g: 167, b: 115, groups: ['4']  }, // #FEA773
        { id: 'F2', r: 254, g: 102, b: 67, groups: ['4']  }, // #FE6643
        { id: 'G14', r: 140, g: 96, b: 78, groups: ['4']  }, // #8C604E
        { id: 'M9', r: 172, g: 144, b: 123, groups: ['4']  }, // #AC907B
        { id: 'E9', r: 239, g: 198, b: 243, groups: ['4']  }, // #EFC6F3
        { id: 'E6', r: 253, g: 77, b: 130, groups: ['4']  }, // #FD4D82
        { id: 'F12', r: 254, g: 77, b: 107, groups: ['4']  }, // #FE4D6B
        { id: 'F3', r: 236, g: 98, b: 91, groups: ['4']  }, // #EC625B
        { id: 'F11', r: 106, g: 49, b: 29, groups: ['4']  }, // #6A311D
        { id: 'M12', r: 98, g: 80, b: 73, groups: ['4']  }, // #625049
        { id: 'D5', r: 177, g: 89, b: 181, groups: ['4']  }, // #B159B5
        { id: 'E10', r: 178, g: 23, b: 98, groups: ['4']  }, // #B21762
        { id: 'F4', r: 221, g: 81, b: 74, groups: ['4']  }, // #DD514A
        { id: 'F6', r: 151, g: 67, b: 53, groups: ['4']  }, // #974335
        { id: 'G17', r: 81, g: 67, b: 49, groups: ['4']  }, // #514331
        { id: 'H6', r: 47, g: 42, b: 46, groups: ['4']  }, // #2F2A2E

        // --- 字母组 (A, B, C, D, E) ---
        // A 组
        { id: 'B10', r: 124, g: 212, b: 187, groups: ['A']  }, // #7CD4BB
        { id: 'C2', r: 210, g: 250, b: 255, groups: ['A']  }, // #D2FAFF
        { id: 'C3', r: 191, g: 236, b: 255, groups: ['A']  }, // #BFECFF
        { id: 'C13', r: 206, g: 232, b: 255, groups: ['A']  }, // #CEE8FF
        { id: 'D16', r: 227, g: 237, b: 253, groups: ['A']  }, // #E3EDFD
        { id: 'D17', r: 209, g: 224, b: 252, groups: ['A']  }, // #D1E0FC
        { id: 'B6', r: 119, g: 243, b: 192, groups: ['A']  }, // #77F3C0
        { id: 'C4', r: 124, g: 202, b: 241, groups: ['A']  }, // #7CCAF1
        { id: 'C10', r: 75, g: 183, b: 225, groups: ['A']  }, // #4BB7E1
        { id: 'C17', r: 113, g: 216, b: 232, groups: ['A']  }, // #71D8E8
        { id: 'D1', r: 153, g: 185, b: 249, groups: ['A']  }, // #99B9F9
        { id: 'D11', r: 180, g: 187, b: 239, groups: ['A']  }, // #B4BBEF
        { id: 'C15', r: 38, g: 211, b: 211, groups: ['A']  }, // #26D3D3
        { id: 'C11', r: 35, g: 198, b: 211, groups: ['A']  }, // #23C6D3
        { id: 'C5', r: 44, g: 178, b: 235, groups: ['A']  }, // #2CB2EB
        { id: 'C6', r: 125, g: 187, b: 237, groups: ['A']  }, // #7DBBED
        { id: 'C7', r: 62, g: 146, b: 219, groups: ['A']  }, // #3E92DB
        { id: 'D2', r: 134, g: 149, b: 220, groups: ['A']  }, // #8695DC
        { id: 'B19', r: 41, g: 184, b: 150, groups: ['A']  }, // #29B896
        { id: 'B7', r: 11, g: 165, b: 142, groups: ['A']  }, // #0BA58E
        { id: 'C8', r: 26, g: 100, b: 194, groups: ['A']  }, // #1A64C2
        { id: 'C9', r: 19, g: 70, b: 205, groups: ['A']  }, // #1346CD
        { id: 'D3', r: 25, g: 62, b: 176, groups: ['A']  }, // #193EB0
        { id: 'C16', r: 42, g: 91, b: 143, groups: ['A']  }, // #2A5B8F

        // B 组
        { id: 'E12', r: 254, g: 167, b: 213, groups: ['B']  }, // #FEA7D5
        { id: 'E2', r: 255, g: 210, b: 232, groups: ['B']  }, // #FFD2E8
        { id: 'E8', r: 255, g: 230, b: 235, groups: ['B']  }, // #FFE6EB
        { id: 'D19', r: 234, g: 213, b: 231, groups: ['B']  }, // #EAD5E7
        { id: 'D8', r: 228, g: 211, b: 255, groups: ['B']  }, // #E4D3FF
        { id: 'D9', r: 214, g: 186, b: 245, groups: ['B']  }, // #D6BAF5
        { id: 'E6', r: 253, g: 77, b: 130, groups: ['B']  }, // #FD4D82
        { id: 'E4', r: 237, g: 127, b: 175, groups: ['B']  }, // #ED7FAF
        { id: 'E3', r: 246, g: 178, b: 205, groups: ['B']  }, // #F6B2CD
        { id: 'E9', r: 239, g: 198, b: 243, groups: ['B']  }, // #EFC6F3
        { id: 'D12', r: 230, g: 176, b: 241, groups: ['B']  }, // #E6B0F1
        { id: 'D6', r: 169, g: 125, b: 220, groups: ['B']  }, // #A97DDC
        { id: 'E5', r: 232, g: 89, b: 158, groups: ['B']  }, // #E8599E
        { id: 'E10', r: 178, g: 23, b: 98, groups: ['B']  }, // #B21762
        { id: 'D5', r: 177, g: 89, b: 181, groups: ['B']  }, // #B159B5
        { id: 'D13', r: 208, g: 12, b: 150, groups: ['B']  }, // #D00C96
        { id: 'D20', r: 157, g: 85, b: 183, groups: ['B']  }, // #9D55B7
        { id: 'D18', r: 155, g: 100, b: 194, groups: ['B']  }, // #9B64C2
        { id: 'E7', r: 156, g: 2, b: 78, groups: ['B']  }, // #9C024E
        { id: 'E13', r: 151, g: 5, b: 102, groups: ['B']  }, // #970566
        { id: 'D21', r: 150, g: 56, b: 150, groups: ['B']  }, // #963896
        { id: 'D14', r: 157, g: 62, b: 158, groups: ['B']  }, // #9D3E9E
        { id: 'D7', r: 126, g: 71, b: 163, groups: ['B']  }, // #7E47A3
        { id: 'D15', r: 10, g: 54, b: 91, groups: ['B']  }, // #0A365B

        // C 组
        { id: 'C14', r: 231, g: 250, b: 253, groups: ['C']  }, // #E7FAFD
        { id: 'B20', r: 216, g: 249, b: 219, groups: ['C']  }, // #D8F9DB
        { id: 'C1', r: 231, g: 254, b: 242, groups: ['C']  }, // #E7FEF2
        { id: 'B18', r: 224, g: 241, b: 70, groups: ['C']  }, // #E0F146
        { id: 'M5', r: 209, g: 204, b: 169, groups: ['C']  }, // #D1CCA9
        { id: 'M6', r: 176, g: 167, b: 129, groups: ['C']  }, // #B0A781
        { id: 'B3', r: 184, g: 254, b: 190, groups: ['C']  }, // #B8FEBE
        { id: 'B16', r: 212, g: 241, b: 153, groups: ['C']  }, // #D4F199
        { id: 'B13', r: 219, g: 243, b: 133, groups: ['C']  }, // #DBF385
        { id: 'B1', r: 225, g: 233, b: 77, groups: ['C']  }, // #E1E94D
        { id: 'G13', r: 182, g: 123, b: 89, groups: ['C']  }, // #B67B59
        { id: 'F10', r: 150, g: 85, b: 56, groups: ['C']  }, // #965538
        { id: 'B5', r: 79, g: 223, b: 104, groups: ['C']  }, // #4FDF68
        { id: 'B4', r: 110, g: 245, b: 71, groups: ['C']  }, // #6EF547
        { id: 'B2', r: 119, g: 251, b: 80, groups: ['C']  }, // #77FB50
        { id: 'B14', r: 234, g: 254, b: 200, groups: ['C']  }, // #EAFEC8
        { id: 'G7', r: 162, g: 111, b: 74, groups: ['C']  }, // #A26F4A
        { id: 'F11', r: 106, g: 49, b: 29, groups: ['C']  }, // #6A311D
        { id: 'B15', r: 17, g: 100, b: 30, groups: ['C']  }, // #11641E
        { id: 'B12', r: 0, g: 147, b: 109, groups: ['C']  }, // #00936D
        { id: 'B8', r: 8, g: 164, b: 71, groups: ['C']  }, // #08A447
        { id: 'B17', r: 192, g: 214, b: 89, groups: ['C']  }, // #C0D659
        { id: 'B11', r: 91, g: 114, b: 43, groups: ['C']  }, // #5B722B
        { id: 'G8', r: 74, g: 45, b: 27, groups: ['C']  }, // #4A2D1B

        // D 组
        { id: 'A15', r: 254, g: 254, b: 98, groups: ['D']  }, // #FEFE62
        { id: 'A3', r: 255, g: 255, b: 140, groups: ['D']  }, // #FFFF8C
        { id: 'A11', r: 253, g: 215, b: 154, groups: ['D']  }, // #FDD79A
        { id: 'A9', r: 253, g: 168, b: 115, groups: ['D']  }, // #FDA873
        { id: 'F14', r: 254, g: 182, b: 182, groups: ['D']  }, // #FEB6B6
        { id: 'F12', r: 254, g: 77, b: 107, groups: ['D']  }, // #FE4D6B
        { id: 'A4', r: 255, g: 241, b: 94, groups: ['D']  }, // #FFF15E
        { id: 'A13', r: 251, g: 200, b: 76, groups: ['D']  }, // #FBC84C
        { id: 'A6', r: 255, g: 196, b: 69, groups: ['D']  }, // #FFC445
        { id: 'F1', r: 254, g: 143, b: 116, groups: ['D']  }, // #FE8F74
        { id: 'F2', r: 254, g: 102, b: 67, groups: ['D']  }, // #FE6643
        { id: 'F3', r: 236, g: 98, b: 91, groups: ['D']  }, // #EC625B
        { id: 'A5', r: 255, g: 229, b: 80, groups: ['D']  }, // #FFE550
        { id: 'A10', r: 253, g: 169, b: 84, groups: ['D']  }, // #FDA954
        { id: 'A7', r: 255, g: 148, b: 53, groups: ['D']  }, // #FF9435
        { id: 'F13', r: 228, g: 79, b: 63, groups: ['D']  }, // #E44F3F
        { id: 'F9', r: 254, g: 167, b: 115, groups: ['D']  }, // #FEA773
        { id: 'F6', r: 151, g: 67, b: 53, groups: ['D']  }, // #974335
        { id: 'A8', r: 250, g: 222, b: 69, groups: ['D']  }, // #FADE45
        { id: 'A14', r: 251, g: 109, b: 81, groups: ['D']  }, // #FB6D51
        { id: 'F4', r: 221, g: 81, b: 74, groups: ['D']  }, // #DD514A
        { id: 'F5', r: 210, g: 74, b: 68, groups: ['D']  }, // #D24A44
        { id: 'F8', r: 160, g: 64, b: 55, groups: ['D']  }, // #A04037
        { id: 'F7', r: 134, g: 34, b: 38, groups: ['D']  }, // #862226

        // E 组
        { id: 'E15', r: 254, g: 225, b: 226, groups: ['E']  }, // #FEE1E2
        { id: 'E1', r: 254, g: 230, b: 223, groups: ['E']  }, // #FEE6DF
        { id: 'E14', r: 255, g: 218, b: 193, groups: ['E']  }, // #FFDAC1
        { id: 'E11', r: 254, g: 232, b: 219, groups: ['E']  }, // #FEE8DB
        { id: 'H2', r: 255, g: 254, b: 255, groups: ['E']  }, // #FFFEFF
        { id: 'H1', r: 251, g: 251, b: 253, groups: ['E']  }, // #FBFBFD
        { id: 'A12', r: 255, g: 192, b: 161, groups: ['E']  }, // #FFC0A1
        { id: 'G3', r: 244, g: 205, b: 166, groups: ['E']  }, // #F4CDA6
        { id: 'G2', r: 255, g: 217, b: 192, groups: ['E']  }, // #FFD9C0
        { id: 'G1', r: 253, g: 238, b: 215, groups: ['E']  }, // #FDEED7
        { id: 'A1', r: 255, g: 251, b: 214, groups: ['E']  }, // #FFFBD6
        { id: 'H12', r: 253, g: 252, b: 243, groups: ['E']  }, // #FDFCF3
        { id: 'G6', r: 228, g: 145, b: 80, groups: ['E']  }, // #E49150
        { id: 'G5', r: 237, g: 158, b: 96, groups: ['E']  }, // #ED9E60
        { id: 'G9', r: 242, g: 190, b: 144, groups: ['E']  }, // #F2BE90
        { id: 'M9', r: 172, g: 144, b: 123, groups: ['E']  }, // #AC907B
        { id: 'H3', r: 187, g: 187, b: 187, groups: ['E']  }, // #BBBBBB
        { id: 'H4', r: 136, g: 132, b: 139, groups: ['E']  }, // #88848B
        { id: 'G14', r: 140, g: 96, b: 78, groups: ['E']  }, // #8C604E
        { id: 'M12', r: 98, g: 80, b: 73, groups: ['E']  }, // #625049
        { id: 'G17', r: 81, g: 67, b: 49, groups: ['E']  }, // #514331
        { id: 'H5', r: 73, g: 71, b: 77, groups: ['E']  }, // #49474D
        { id: 'H6', r: 47, g: 42, b: 46, groups: ['E']  }, // #2F2A2E
        { id: 'H7', r: 5, g: 5, b: 5, groups: ['E']  }, // #050505

        // --- 扩展组 (6, 9, 10, 11, 7, 8) ---
        // 第 6 组
        { id: 'H8', r: 244, g: 235, b: 241, groups: ['6']  }, // #F4EBF1
        { id: 'G15', r: 249, g: 244, b: 227, groups: ['6']  }, // #F9F4E3
        { id: 'A2', r: 255, g: 253, b: 222, groups: ['6']  }, // #FFFDDE
        { id: 'H13', r: 246, g: 237, b: 216, groups: ['6']  }, // #F6EDD8
        { id: 'G16', r: 238, g: 228, b: 202, groups: ['6']  }, // #EEE4CA
        { id: 'H9', r: 244, g: 242, b: 240, groups: ['6']  }, // #F4F2F0
        { id: 'H10', r: 236, g: 232, b: 234, groups: ['6']  }, // #ECE8EA
        { id: 'M1', r: 208, g: 217, b: 205, groups: ['6']  }, // #D0D9CD
        { id: 'G11', r: 223, g: 208, b: 163, groups: ['6']  }, // #DFD0A3
        { id: 'G4', r: 224, g: 180, b: 131, groups: ['6']  }, // #E0B483
        { id: 'M4', r: 229, g: 210, b: 187, groups: ['6']  }, // #E5D2BB
        { id: 'H14', r: 217, g: 225, b: 224, groups: ['6']  }, // #D9E1E0
        { id: 'M10', r: 188, g: 164, b: 173, groups: ['6']  }, // #BCA4AD
        { id: 'M2', r: 140, g: 163, b: 134, groups: ['6']  }, // #8CA386
        { id: 'G12', r: 240, g: 204, b: 146, groups: ['6']  }, // #F0CC92
        { id: 'M13', r: 189, g: 141, b: 113, groups: ['6']  }, // #BD8D71
        { id: 'M7', r: 180, g: 164, b: 152, groups: ['6']  }, // #B4A498
        { id: 'H11', r: 204, g: 204, b: 193, groups: ['6']  }, // #CCCCC1
        { id: 'M11', r: 153, g: 125, b: 138, groups: ['6']  }, // #997D8A
        { id: 'M3', r: 106, g: 126, b: 126, groups: ['6']  }, // #6A7E7E
        { id: 'G10', r: 194, g: 138, b: 80, groups: ['6']  }, // #C28A50
        { id: 'M14', r: 196, g: 121, b: 107, groups: ['6']  }, // #C4796B
        { id: 'M8', r: 183, g: 152, b: 145, groups: ['6']  }, // #B79891
        { id: 'M15', r: 113, g: 121, b: 118, groups: ['6']  }, // #717976

        // 第 9 组
        { id: 'H17', r: 243, g: 245, b: 244, groups: ['9']  }, // #F3F5F4
        { id: 'H18', r: 249, g: 249, b: 249, groups: ['9']  }, // #F9F9F9
        { id: 'H19', r: 247, g: 249, b: 242, groups: ['9']  }, // #F7F9F2
        { id: 'E16', r: 254, g: 249, b: 240, groups: ['9']  }, // #FEF9F0
        { id: 'F16', r: 254, g: 209, b: 182, groups: ['9']  }, // #FED1B6
        { id: 'F17', r: 248, g: 172, b: 137, groups: ['9']  }, // #F8AC89
        { id: 'D23', r: 240, g: 233, b: 251, groups: ['9']  }, // #F0E9FB
        { id: 'E24', r: 254, g: 247, b: 251, groups: ['9']  }, // #FEF7FB
        { id: 'E19', r: 249, g: 224, b: 245, groups: ['9']  }, // #F9E0F5
        { id: 'E18', r: 251, g: 213, b: 224, groups: ['9']  }, // #FBD5E0
        { id: 'E17', r: 247, g: 232, b: 238, groups: ['9']  }, // #F7E8EE
        { id: 'E20', r: 239, g: 221, b: 235, groups: ['9']  }, // #EFDDEB
        { id: 'B24', r: 234, g: 243, b: 190, groups: ['9']  }, // #EAF3BE
        { id: 'A16', r: 253, g: 253, b: 180, groups: ['9']  }, // #FDFDB4
        { id: 'A17', r: 254, g: 224, b: 123, groups: ['9']  }, // #FEE07B
        { id: 'A18', r: 252, g: 206, b: 163, groups: ['9']  }, // #FCCEA3
        { id: 'F24', r: 254, g: 189, b: 196, groups: ['9']  }, // #FEBDC4
        { id: 'F23', r: 232, g: 117, b: 97, groups: ['9']  }, // #E87561
        { id: 'A24', r: 246, g: 254, b: 209, groups: ['9']  }, // #F6FED1
        { id: 'A22', r: 253, g: 246, b: 159, groups: ['9']  }, // #FDF69F
        { id: 'A21', r: 253, g: 230, b: 149, groups: ['9']  }, // #FDE695
        { id: 'F21', r: 242, g: 189, b: 196, groups: ['9']  }, // #F2BDC4
        { id: 'F22', r: 254, g: 189, b: 192, groups: ['9']  }, // #FEBDC0
        { id: 'A19', r: 250, g: 135, b: 114, groups: ['9']  }, // #FA8772

        // 第 10 组
        { id: 'A26', r: 255, g: 196, b: 38, groups: ['10']  }, // #FFC426
        { id: 'A25', r: 252, g: 221, b: 89, groups: ['10']  }, // #FCDD59
        { id: 'A20', r: 252, g: 219, b: 98, groups: ['10']  }, // #FCDB62
        { id: 'A23', r: 249, g: 229, b: 214, groups: ['10']  }, // #F9E5D6
        { id: 'G18', r: 252, g: 249, b: 236, groups: ['10']  }, // #FCF9EC
        { id: 'H21', r: 253, g: 253, b: 245, groups: ['10']  }, // #FDFDF5
        { id: 'B26', r: 143, g: 125, b: 70, groups: ['10']  }, // #8F7D46
        { id: 'B32', r: 194, g: 211, b: 90, groups: ['10']  }, // #C2D35A
        { id: 'B31', r: 199, g: 232, b: 184, groups: ['10']  }, // #C7E8B8
        { id: 'B30', r: 241, g: 250, b: 208, groups: ['10']  }, // #F1FAD0
        { id: 'B27', r: 191, g: 206, b: 156, groups: ['10']  }, // #BFCE9C
        { id: 'B29', r: 208, g: 227, b: 91, groups: ['10']  }, // #D0E35B
        { id: 'C22', r: 151, g: 209, b: 215, groups: ['10']  }, // #97D1D7
        { id: 'C23', r: 216, g: 235, b: 243, groups: ['10']  }, // #D8EBF3
        { id: 'C24', r: 152, g: 211, b: 254, groups: ['10']  }, // #98D3FE
        { id: 'B28', r: 169, g: 245, b: 197, groups: ['10']  }, // #A9F5C5
        { id: 'C25', r: 203, g: 242, b: 239, groups: ['10']  }, // #CBF2EF
        { id: 'C27', r: 233, g: 242, b: 250, groups: ['10']  }, // #E9F2FA
        { id: 'H15', r: 154, g: 165, b: 168, groups: ['10']  }, // #9AA5A8
        { id: 'H20', r: 149, g: 162, b: 164, groups: ['10']  }, // #95A2A4
        { id: 'H23', r: 178, g: 186, b: 168, groups: ['10']  }, // #B2BAA8
        { id: 'H22', r: 243, g: 241, b: 242, groups: ['10']  }, // #F3F1F2
        { id: 'C28', r: 227, g: 237, b: 253, groups: ['10']  }, // #E3EDFD
        { id: 'C21', r: 227, g: 241, b: 252, groups: ['10']  }, // #E3F1FC

        // 第 11 组
        { id: 'F15', r: 194, g: 49, b: 49, groups: ['11']  }, // #C23131
        { id: 'F19', r: 192, g: 68, b: 74, groups: ['11']  }, // #C0444A
        { id: 'G20', r: 166, g: 87, b: 55, groups: ['11']  }, // #A65737
        { id: 'E21', r: 211, g: 176, b: 181, groups: ['11']  }, // #D3B0B5
        { id: 'E22', r: 196, g: 144, b: 173, groups: ['11']  }, // #C490AD
        { id: 'D26', r: 216, g: 189, b: 245, groups: ['11']  }, // #D8BDF5
        { id: 'F25', r: 254, g: 106, b: 106, groups: ['11']  }, // #FE6A6A
        { id: 'F20', r: 190, g: 141, b: 141, groups: ['11']  }, // #BE8D8D
        { id: 'G19', r: 238, g: 167, b: 80, groups: ['11']  }, // #EEA750
        { id: 'F18', r: 243, g: 148, b: 103, groups: ['11']  }, // #F39467
        { id: 'G21', r: 192, g: 147, b: 116, groups: ['11']  }, // #C09374
        { id: 'E23', r: 146, g: 125, b: 137, groups: ['11']  }, // #927D89
        { id: 'D25', r: 68, g: 82, b: 205, groups: ['11']  }, // #4452CD
        { id: 'D22', r: 70, g: 85, b: 177, groups: ['11']  }, // #4655B1
        { id: 'D24', r: 124, g: 142, b: 230, groups: ['11']  }, // #7C8EE6
        { id: 'C20', r: 58, g: 134, b: 195, groups: ['11']  }, // #3A86C3
        { id: 'B21', r: 14, g: 159, b: 139, groups: ['11']  }, // #0E9F8B
        { id: 'B25', r: 100, g: 136, b: 112, groups: ['11']  }, // #648870
        { id: 'H16', r: 57, g: 45, b: 38, groups: ['11']  }, // #392D26
        { id: 'B23', r: 52, g: 68, b: 21, groups: ['11']  }, // #344415
        { id: 'C18', r: 31, g: 66, b: 70, groups: ['11']  }, // #1F4246
        { id: 'B22', r: 0, g: 69, b: 70, groups: ['11']  }, // #004546
        { id: 'C19', r: 0, g: 150, b: 160, groups: ['11']  }, // #0096A0
        { id: 'C26', r: 75, g: 174, b: 212, groups: ['11']  }, // #4BAED4

        // 第 7 组
        { id: 'P18', r: 40, g: 40, b: 40, groups: ['7']  }, // #282828
        { id: 'P16', r: 255, g: 220, b: 150, groups: ['7']  }, // #FFDC96
        { id: 'P3', r: 255, g: 255, b: 100, groups: ['7']  }, // #FFFF64
        { id: 'P12', r: 76, g: 46, b: 36, groups: ['7']  }, // #4C2E24
        { id: 'P1', r: 255, g: 255, b: 255, groups: ['7']  }, // #FFFFFF
        { id: 'T1', r: 255, g: 255, b: 255, groups: ['7']  }, // #FFFFFF
        { id: 'P7', r: 104, g: 58, b: 154, groups: ['7']  }, // #683A9A
        { id: 'P17', r: 140, g: 140, b: 140, groups: ['7']  }, // #8C8C8C
        { id: 'P6', r: 255, g: 147, b: 192, groups: ['7']  }, // #FF93C0
        { id: 'P13', r: 129, g: 132, b: 138, groups: ['7']  }, // #81848A
        { id: 'P9', r: 28, g: 151, b: 210, groups: ['7']  }, // #1C97D2
        { id: 'P11', r: 105, g: 190, b: 90, groups: ['7']  }, // #69BE5A
        { id: 'P4', r: 255, g: 108, b: 47, groups: ['7']  }, // #FF6C2F
        { id: 'P5', r: 190, g: 0, b: 47, groups: ['7']  }, // #BE002F
        { id: 'P15', r: 50, g: 174, b: 95, groups: ['7']  }, // #32AE5F
        { id: 'P14', r: 0, g: 0, b: 0, groups: ['7']  }, // #000000
        { id: 'P2', r: 227, g: 216, b: 172, groups: ['7']  }, // #E3D8AC
        { id: 'R12', r: 220, g: 40, b: 40, groups: ['7']  }, // #DC2828
        { id: 'P23', r: 30, g: 125, b: 65, groups: ['7']  }, // #1E7D41
        { id: 'P22', r: 55, g: 155, b: 85, groups: ['7']  }, // #379B55
        { id: 'P21', r: 168, g: 112, b: 66, groups: ['7']  }, // #A87042
        { id: 'P20', r: 161, g: 67, b: 40, groups: ['7']  }, // #A14328
        { id: 'P19', r: 255, g: 255, b: 255, groups: ['7']  }, // #FFFFFF
        { id: 'P8', r: 13, g: 43, b: 109, groups: ['7']  }, // #0D2B6D

        // 第 8 组
        { id: 'P10', r: 0, g: 103, b: 62, groups: ['8']  }, // #00673E
        { id: 'R11', r: 255, g: 50, b: 50, groups: ['8']  }, // #FF3232
        { id: 'Y2', r: 255, g: 255, b: 0, groups: ['8']  }, // #FFFF00
        { id: 'Y3', r: 200, g: 255, b: 0, groups: ['8']  }, // #C8FF00
        { id: 'G2', r: 255, g: 217, b: 192, groups: ['8']  }, // #FFD9C0
        { id: 'Y4', r: 160, g: 220, b: 0, groups: ['8']  }, // #A0DC00
        { id: 'Y5', r: 120, g: 180, b: 0, groups: ['8']  }, // #78B400
        { id: 'Y1', r: 255, g: 255, b: 0, groups: ['8']  }, // #FFFF00
        { id: 'R3', r: 180, g: 30, b: 30, groups: ['8']  }, // #B41E1E
        { id: 'R4', r: 140, g: 20, b: 20, groups: ['8']  }, // #8C1414
        { id: 'R5', r: 100, g: 10, b: 10, groups: ['8']  }, // #640A0A
        { id: 'R8', r: 120, g: 20, b: 20, groups: ['8']  }, // #781414
        { id: 'R9', r: 120, g: 20, b: 20, groups: ['8']  }, // #781414
        { id: 'R2', r: 220, g: 40, b: 40, groups: ['8']  }, // #DC2828
        { id: 'R1', r: 255, g: 50, b: 50, groups: ['8']  }, // #FF3232
        { id: 'R10', r: 120, g: 20, b: 20, groups: ['8']  }, // #781414
        { id: 'R6', r: 100, g: 10, b: 10, groups: ['8']  }, // #640A0A
        { id: 'R7', r: 100, g: 10, b: 10, groups: ['8']  }, // #640A0A
        { id: 'D10', r: 45, g: 29, b: 77, groups: ['8']  }, // #2D1D4D
        { id: 'R13', r: 180, g: 30, b: 30, groups: ['8']  }, // #B41E1E
        { id: 'G5', r: 237, g: 158, b: 96, groups: ['8']  }, // #ED9E60
        { id: 'B9', r: 32, g: 102, b: 63, groups: ['8']  }, // #20663F
        { id: 'G12', r: 240, g: 204, b: 146, groups: ['8']  }, // #F0CC92
        { id: 'D4', r: 1, g: 53, b: 117, groups: ['8']  }, // #013575
        { id: 'C12', r: 7, g: 78, b: 95, groups: ['8']  }, // #074E5F

        // 排除色
        { id: 'C29', r: 59, g: 78, b: 129, groups: ['other'] }, // #3B4E81
    ],
    artkal: [
        // Artkal Core 核心系列
        { id: 'A-Core1', r: 255, g: 200, b: 50, name: '核心黄' }, // #FFC832
        { id: 'B-Core1', r: 200, g: 50, b: 255, name: '核心紫' }, // #C832FF
        { id: 'C-Core1', r: 50, g: 255, b: 100, name: '核心绿' }, // #32FF64
        { id: 'D-Core1', r: 100, g: 100, b: 255, name: '核心蓝' }, // #6464FF
        { id: 'E-Core1', r: 200, g: 200, b: 200, name: '核心灰' }, // #C8C8C8
        { id: 'S01', r: 255, g: 255, b: 255, name: '纯白'  }, // #FFFFFF
        { id: 'S02', r: 0, g: 0, b: 0, name: '纯黑'  }, // #000000
        { id: 'S13', r: 190, g: 0, b: 47, name: '红色'  }, // #BE002F
        { id: 'S31', r: 28, g: 151, b: 210, name: '浅蓝'  }, // #1C97D2
        { id: 'S34', r: 105, g: 190, b: 90, name: '草绿' }, // #69BE5A
    ],
    perler: [
        { id: 'P01', name: '白色', r: 255, g: 255, b: 255 }, // #FFFFFF
        { id: 'P02', name: '奶油色', r: 227, g: 216, b: 172 }, // #E3D8AC
        { id: 'P03', name: '黄色', r: 247, g: 229, b: 59 }, // #F7E53B
        { id: 'P04', name: '橙色', r: 255, g: 108, b: 47 }, // #FF6C2F
        { id: 'P05', name: '红色', r: 190, g: 0, b: 47 }, // #BE002F
        { id: 'P06', name: '粉色', r: 255, g: 147, b: 192 }, // #FF93C0
        { id: 'P07', name: '紫色', r: 104, g: 58, b: 154 }, // #683A9A
        { id: 'P08', name: '深蓝', r: 13, g: 43, b: 109 }, // #0D2B6D
        { id: 'P09', name: '浅蓝', r: 28, g: 151, b: 210 }, // #1C97D2
        { id: 'P10', name: '深绿', r: 0, g: 103, b: 62 }, // #00673E
        { id: 'P11', name: '浅绿', r: 105, g: 190, b: 90 }, // #69BE5A
        { id: 'P12', name: '棕色', r: 76, g: 46, b: 36 }, // #4C2E24
        { id: 'P13', name: '灰色', r: 129, g: 132, b: 138 }, // #81848A
        { id: 'P14', name: '黑色', r: 0, g: 0, b: 0 }, // #000000
        { id: 'P18', name: '深黑', r: 45, g: 45, b: 45 }, // #2D2D2D
        { id: 'P17', name: '灰白', r: 140, g: 140, b: 140 }, // #8C8C8C
        { id: 'P19', name: '透明', r: 255, g: 255, b: 255, alpha: 0.2 }, // #FFFFFF
        { id: 'P20', name: '铁锈红', r: 161, g: 67, b: 40 }, // #A14328
        { id: 'P21', name: '浅棕', r: 168, g: 112, b: 66 }, // #A87042
    ],
    hama: [
        { id: 'H01', name: '白色', r: 255, g: 255, b: 255 }, // #FFFFFF
        { id: 'H05', name: '红色', r: 204, g: 0, b: 0 }, // #CC0000
        { id: 'H18', name: '黑色', r: 0, g: 0, b: 0 }, // #000000
    ]
};
// Test append
