package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/reusee/e/v2"
	"github.com/rjeczalik/notify"
)

var (
	pt     = fmt.Printf
	me     = e.Default.WithStack().WithName("afftesting")
	ce, he = e.New(me)
)

type (
	M = map[string]interface{}
)

func init() {
	go func() {
		c := make(chan notify.EventInfo, 32)
		for _, watchDir := range []string{
			".", "./aff",
		} {
			if err := notify.Watch(watchDir, c, notify.Create, notify.Write); err != nil {
				panic(err)
			}
			defer notify.Stop(c)
			pt("watching %s\n", watchDir)
		}

	build:
		buildUI()

	wait:
		ev := <-c
		path := ev.Path()
		if !strings.HasSuffix(path, ".ts") {
			goto wait
		}
		after := time.NewTimer(time.Millisecond * 50)
	batch:
		for {
			select {
			case ev := <-c:
				_ = ev
				if !after.Stop() {
					<-after.C
				}
				after.Reset(time.Millisecond * 50)
			case <-after.C:
				break batch
			}
		}
		goto build
	}()
}

func copyDir(src, dest string) error {
	stat, err := os.Stat(src)
	if err != nil {
		return err
	}
	if stat.IsDir() {
		stat, err = os.Stat(dest)
		if os.IsNotExist(err) {
			if err := os.Mkdir(dest, 0655); err != nil {
				return err
			}
		} else if !stat.IsDir() {
			return fmt.Errorf("%s is not dir", dest)
		}
		f, err := os.Open(src)
		if err != nil {
			return err
		}
		defer f.Close()
		names, err := f.Readdirnames(-1)
		if err != nil {
			return err
		}
		for _, name := range names {
			if err := copyDir(
				filepath.Join(src, name),
				filepath.Join(dest, name),
			); err != nil {
				return err
			}
		}
	} else {
		in, err := os.Open(src)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.Create(dest)
		if err != nil {
			return err
		}
		defer out.Close()
		if _, err := io.Copy(out, in); err != nil {
			return err
		}
	}
	return nil
}

func buildUI() {
	t0 := time.Now()
	pt("%v rebuilding...", time.Now().Format("15:04:05.000000"))
	os.Stdout.Sync()

	d1 := "build"
	cmd := exec.Command("tsc",
		"--build", "tsconfig.json",
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		pt("build error: %v\n", err)
		pt("%s\n", out)
		return
	}

	// istanbul coverage
	d2 := "static"
	if out, err := exec.Command(
		"nyc", "instrument",
		d1, d2,
	).CombinedOutput(); err != nil {
		pt("%v\n", err)
		pt("%s\n", out)
		return
	}

	pt("done in %v\n", time.Since(t0))

	waits.Lock()
	for _, c := range waits.waits {
		close(c)
	}
	waits.waits = waits.waits[0:0]
	waits.Unlock()

}

type Dir struct {
	dir http.Dir
}

func (d Dir) Open(filename string) (http.File, error) {
	if filename != "/" {
		ext := path.Ext(filename)
		if ext == "" {
			filename = filename + ".js"
		}
	}
	return d.dir.Open(filename)
}

var waits struct {
	sync.Mutex
	waits []chan bool
}

func handleWait(w http.ResponseWriter, req *http.Request) {
	c := make(chan bool)
	waits.Lock()
	waits.waits = append(waits.waits, c)
	waits.Unlock()
	<-c
}

func handleInit(w http.ResponseWriter, req *http.Request) {
	ce(json.NewEncoder(w).Encode(M{
		"Now": time.Now().Format("2006-01-02 15:04:05.000"),
	}))
}

func handleCoverage(w http.ResponseWriter, req *http.Request) {
	pt("%s coverage report\n", time.Now().Format("15:04:05"))

	cmd := exec.Command(
		"remap-istanbul",
		"-o", filepath.Join("..", ".nyc_output", "cover.json"),
	)
	cmd.Dir = "build"
	cmd.Stdin = req.Body
	out, err := cmd.CombinedOutput()
	if err != nil || bytes.Contains(out, []byte("Error")) {
		pt("%s\n", out)
		pt("%v\n", err)
		return
	}

	cmd = exec.Command(
		"nyc", "report",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		pt("%v\n", err)
	}

}

func main() {
	mux := http.NewServeMux()

	mux.Handle("/", http.FileServer(Dir{http.Dir("static")}))

	mux.HandleFunc("/wait", handleWait)
	mux.HandleFunc("/init", handleInit)
	mux.HandleFunc("/coverage", handleCoverage)

	pt("open localhost:23456 in browser to run tests\n")

	if err := http.ListenAndServe(":23456", mux); err != nil {
		panic(err)
	}
}
