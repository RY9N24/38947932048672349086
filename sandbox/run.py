import sys, json, os, subprocess, resource, signal, math, tempfile, time, ctypes

def main():
    # The participant uses the same unprivileged UID. Deny access to the trusted
    # harness's /proc/<pid>/{fd,mem}; hidden tests remain only in harness memory.
    if ctypes.CDLL(None).prctl(4, 0, 0, 0, 0) != 0:
        raise RuntimeError('Cannot protect harness process')
    data=json.loads(sys.stdin.readline())
    language=data['language']; tl=data.get('timeMs',1000)/1000; ml=data.get('memoryMb',256)
    path='/work/main.py' if language=='python' else '/work/main.cpp'
    with open(path,'w') as f: f.write(data['code'])
    compile_cmd=['python3','-m','py_compile',path] if language=='python' else ['g++','-O2','-std=c++17',path,'-o','/work/main']
    try:
        compile_result=subprocess.run(compile_cmd,capture_output=True,timeout=10,cwd='/work')
        if compile_result.returncode:
            print(json.dumps({'status':'CE','compileLog':compile_result.stderr[:8192].decode(errors='replace'),'tests':[]}));return
    except subprocess.TimeoutExpired:
        print(json.dumps({'status':'CE','compileLog':'Превышено время компиляции','tests':[]}));return
    results=[]
    for index,test in enumerate(data['tests']):
        def limits():
            os.setsid()
            resource.setrlimit(resource.RLIMIT_CPU,(math.ceil(tl)+1,math.ceil(tl)+1))
            memory=(ml+(64 if language=='python' else 0))*1024*1024
            resource.setrlimit(resource.RLIMIT_AS,(memory,memory))
            resource.setrlimit(resource.RLIMIT_FSIZE,(16*1024*1024,16*1024*1024))
            resource.setrlimit(resource.RLIMIT_NPROC,(48,48))
            resource.setrlimit(resource.RLIMIT_NOFILE,(32,32))
            resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        before=resource.getrusage(resource.RUSAGE_CHILDREN); started=time.monotonic()
        with tempfile.TemporaryFile() as out,tempfile.TemporaryFile() as err:
            proc=subprocess.Popen(['python3','-I',path] if language=='python' else ['/work/main'],stdin=subprocess.PIPE,stdout=out,stderr=err,cwd='/work',preexec_fn=limits,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/work'})
            status='OK'
            try: proc.communicate(test['input'].encode(),timeout=max(.2,tl*2))
            except subprocess.TimeoutExpired:
                status='TLE'
                try: os.killpg(proc.pid,signal.SIGKILL)
                except ProcessLookupError: pass
                proc.wait()
            finally:
                try: os.killpg(proc.pid,signal.SIGKILL)
                except ProcessLookupError: pass
            usage=resource.getrusage(resource.RUSAGE_CHILDREN)
            cpu=(usage.ru_utime+usage.ru_stime-before.ru_utime-before.ru_stime)*1000
            out.seek(0); actual=out.read(16*1024*1024+1).decode(errors='replace'); err.seek(0); error=err.read(8192).decode(errors='replace')
            if status=='OK':
                if 'MemoryError' in error or 'bad_alloc' in error: status='MLE'
                elif proc.returncode in [-signal.SIGXCPU,-signal.SIGKILL] or cpu>tl*1000: status='TLE'
                elif proc.returncode: status='RE'
                else:
                    expected=test['output']; checker=data.get('checker','tokens')
                    if checker=='exact': good=actual==expected
                    elif checker.startswith('float:'):
                        try:
                            a=actual.split(); b=expected.split(); eps=float(checker.split(':')[1]); good=len(a)==len(b) and all(math.isfinite(float(x)) and abs(float(x)-float(y))<=eps*max(1,abs(float(y))) for x,y in zip(a,b))
                        except ValueError: good=False
                    else: good=actual.split()==expected.split()
                    if not good: status='WA'
            results.append({'i':index+1,'verdict':status,'timeMs':round(cpu),'memKb':usage.ru_maxrss})
        if status!='OK' and data.get('scoring','ICPC')=='ICPC': break
    passed=sum(x['verdict']=='OK' for x in results)
    status='OK' if passed==len(data['tests']) else next((x['verdict'] for x in results if x['verdict']!='OK'),'WA')
    print(json.dumps({'status':status,'tests':results,'score':round(passed/len(data['tests'])*100,2)}))
try: main()
except Exception as exc:
    print(json.dumps({'status':'SE','tests':[],'message':'Ошибка среды проверки','diagnostic':type(exc).__name__+': '+str(exc)[:200]}))
