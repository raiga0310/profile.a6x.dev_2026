func process() error {
    f, err := os.Open("data.txt")
    if err != nil {
        return err
    }
    defer f.Close() // 関数終了時に必ず実行

    data, _ := io.ReadAll(f)
    fmt.Println(string(data))
    return nil
}
